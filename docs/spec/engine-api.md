# Engine API

## 1. Scope

This document defines the public API surface exposed by the engine to plugins,
components, and the editor shell. Every method that mutates state goes through
the command bus. Every method that reads state is pure.

## 2. Architecture

The engine exposes capabilities organized by domain:

```
Engine
 ├── command        Action dispatch
 ├── selector       Reactive read access (SceneStore)
 ├── computed       Derived data (ComputedStore)
 ├── events         Unified event bus
 ├── history        Undo/redo
 └── transaction    Multi-action transactions
```

Data flow for mutations:

```
Plugin/Component
  → engine.command()
  → CommandBus.middleware[]
  → Handler (with validation)
  → engine.selector.setScene()  (sync query layer)
  → engine.events.emit()        (notify subscribers)
```

The EventBus is the single notification hub. All downstream consumers
(scene subscribers, selection subscribers, history, collaboration sync)
hook into it — services never notify consumers directly.

## 3. Unified Result Type

Every mutation method returns `CommandResult` instead of `void` or a
bespoke type.

```ts
export interface CommandResult {
  ok: boolean
  error?: {
    code: string
    message: string
    actionType?: string
    nodeId?: string
  }
}
```

Rules:

1. `ok === true` means the mutation was applied atomically.
2. `ok === false` means the scene is unchanged — no partial mutation.
3. `error.code` is a machine-readable invariant identifier.

## 4. Engine

The top-level composition root. Every plugin accesses engine capabilities
through the engine on `NodeRenderContext.engine`.

```ts
export interface Engine {
  command(action: RuntimeAction): CommandResult
  selector: SceneStore
  computed: ComputedStore
  events: EventBus
  history: HistoryService
  transaction: TransactionService
}
```

Rules:

1. The engine holds no state — it is a grouping of independent services.
2. All services are injectable. The engine is assembled in the bootstrap.
3. The engine does not perform validation, notification, or error translation.
   These are handled by lower layers (handlers, middleware, EventBus).
4. `selector` and `computed` are the **only** read interfaces.
   There is no separate "query" layer. Raw node access and derived
   computation share a single path.

## 5. SceneStore

Read-optimized cache and reactive query layer over `SceneGraph`. Formerly
`SelectorRegistry`. Every read method returns a mutable reference to the
internal `SceneGraph` — consumers must not mutate returned objects.

```ts
export interface SceneStore {
  getScene(): SceneGraph
  getNode(nodeId: NodeId): SceneNode | undefined
  getChildren(nodeId: NodeId): SceneNode[]
  getParent(nodeId: NodeId): SceneNode | undefined
  getRoot(): SceneNode
  getAllNodes(): SceneNode[]
  getAncestors(nodeId: NodeId): SceneNode[]
  getDescendants(nodeId: NodeId): NodeId[]
  getSiblings(nodeId: NodeId): SceneNode[]
  getDepth(nodeId: NodeId): number
  isDescendantOf(nodeId: NodeId, ancestorId: NodeId): boolean
  getVisibleNodes(): SceneNode[]
  getNodeLayout(nodeId: NodeId): Record<string, unknown> | undefined
  getNodeLayoutKey(nodeId: NodeId, key: string): unknown
  getNodeProps(nodeId: NodeId): Record<string, unknown> | undefined
  getNodePropsKey(nodeId: NodeId, key: string): unknown
  getNodeVisibility(nodeId: NodeId): boolean | undefined
  isLocked(nodeId: NodeId): boolean
  getBindings(nodeId: NodeId): readonly Binding[]
  getStyle(nodeId: NodeId): Record<string, unknown>
  findNodes(predicate: (node: SceneNode) => boolean): SceneNode[]
  getVersion(): number
}
```

Rules:

1. All methods are pure. They return a view of the current `SceneGraph`.
2. Node-not-found on any `get*` method returns `undefined` or empty value — never throws.
3. `getChildren` returns an empty array for leaf nodes, not `undefined`.
4. `getProps` and `getStyle` return an empty object for nodes with no respective data.
5. `SceneStore` is also the reactive query layer — field-level signal tracking
   is available through `autorun()` for React hooks and computed derivation.
6. React hooks access `SceneStore` via `engine.selector`.

## 6. ComputedStore

Derived state computation from scene layout data. Formerly `ComputedStateEngine`.

```ts
export interface ComputedStore {
  getLocalTransform(nodeId: NodeId): WorldTransform
  getWorldTransform(nodeId: NodeId): WorldTransform
  getComputedBounds(nodeId: NodeId): ComputedBounds
  getVisibleBounds(nodeId: NodeId): ComputedBounds | null
  getCenter(nodeId: NodeId): { x: number; y: number }
  getComputedNode(nodeId: NodeId): ComputedNode | undefined
}
```

Rules:

1. Computed state is invalidated through the scheduler after each
   transaction commit.
2. Computed state never writes back to `SceneGraph`.
3. Repeated reads of the same value with no intermediate scene change
   return cached results.

See `computed-state-engine.md` for the full spec (renamed to `ComputedStore`).

## 7. Command

Pure dispatch. No validation or notification logic lives here — those are
delegated to handlers (validation) and EventBus (notification).

```ts
// Accessed as engine.command()
engine.command(action: RuntimeAction): CommandResult
```

Rules:

1. `dispatch` dispatches through the CommandBus and returns `CommandResult`.
2. Validation is performed by the handler's `validate` function and
   by middleware — the API layer does not duplicate these checks.
3. On success, the CommandBus emits through middleware. The EventBus
   reacts to the state change and notifies subscribers.
4. On failure, the scene is unchanged and the error carries a machine-readable
   code.

## 8. HistoryService

Undo and redo. Both operations are wrapped in a transaction for atomicity.

```ts
export interface HistoryService {
  canUndo(): boolean
  canRedo(): boolean
  undo(): CommandResult
  redo(): CommandResult
  getUndoStackSize(): number
  getRedoStackSize(): number
}
```

Rules:

1. `undo` pops the top entry from the undo stack and applies all inverse
   actions inside a single transaction. If any inverse action fails, the
   transaction is rolled back and the scene is unchanged.
2. `redo` pops the top entry from the redo stack and replays its actions
   inside a single transaction, same rollback guarantee.
3. Calling `undo` when `canUndo()` is false returns `{ ok: false }`.
4. History entry management (push, checkpoint) is handled by middleware
   reacting to committed actions, not by the HistoryService itself.

## 9. TransactionService

Create and manage explicit multi-action transactions.

```ts
export interface TransactionService {
  begin(
    source: TransactionSource,
    metadata?: Record<string, unknown>
  ): TransactionContext
  applyAction(
    context: TransactionContext,
    action: RuntimeAction
  ): CommandResult
  commit(context: TransactionContext): CommandResult
  rollback(context: TransactionContext): void
  getActive(): TransactionContext | undefined
}

export type TransactionSource = 'user' | 'ai' | 'system'
```

Rules:

1. `begin` captures the current pre-state from `SceneStore`.
2. `applyAction` applies one action within the transaction. The action is
   validated by the handler before mutation.
3. `commit` runs the full lifecycle: compute inverse actions, push history
   entry, notify EventBus.
4. `rollback` restores the pre-state via `SceneStore.setScene()` and notifies
   subscribers.
5. When no explicit transaction is open, single-action dispatches create
   an implicit transaction.

Usage by the AI compiler:

```ts
const tx = engine.transaction.begin('ai', { prompt, confidence: 0.95 })
engine.command(createNodeAction(header, root))
engine.command(createNodeAction(image, root))
engine.command(createNodeAction(title, root))
const result = engine.transaction.commit(tx)
if (!result.ok) {
  engine.transaction.rollback(tx)
}
```

## 10. EventBus

Central notification hub with coalescing (setTimeout-based batched delivery).
Wraps `mitt` (200B event emitter library).

```ts
export class EventBus {
  on<K extends keyof EngineEvents>(
    type: K,
    callback: (data: EngineEvents[K]) => void
  ): () => void
  off<K extends keyof EngineEvents>(
    type: K,
    callback: (data: EngineEvents[K]) => void
  ): void
  emit<K extends keyof EngineEvents>(
    type: K,
    data: EngineEvents[K]
  ): void
  dispose(): void
}

type EngineEvents = {
  scene: SceneGraph
  selection: NodeId[]
}
```

Rules:

1. `on` returns an unsubscribe function — call it to clean up.
2. `emit` is async via `setTimeout`. Multiple emits of the same type in
   the same microtask coalesce into a single notification with the
   latest data. This prevents intermediate-state React re-renders.
3. `off` removes a specific handler. No-op if handler was already removed.
4. `dispose` clears all timers and handlers. Call on engine teardown.
5. Event types are extensible via `EngineEvents` — add a new key to add
   a new event channel.
6. The wildcard handler from mitt is available via `events.on("*", cb)`
   for debugging.

## 11. Removed Interfaces

The following interfaces existed in the previous `EngineFacade` design
and have been removed to eliminate dual-reader ambiguity:

| Removed | Replaced By |
|---------|-------------|
| `QueryService` (node, scene, selection) | `SceneStore` via `engine.selector` |
| `CommandService` | `engine.command()` |

    Selection mutation must go through `engine.command()`.
4. HistoryService guards `undo`/`redo` internally — if the stack is empty,
   the call is a no-op (`ok: false`).
5. Event emissions are coalesced to once per microtask for UI rendering.
6. All mutation methods return `CommandResult`. No mutation method returns
   `void`.

Guards that were previously in the Engine API layer and are now removed:

| Removed Guard | Responsible Layer |
|---|---|
| `scene.invalid-parent` check | Handler `validate` function |
| `scene.node-not-found` check | Handler `validate` function |
| `scene.locked` check | Middleware or handler |

## 13. Usage In Plugins

### 13.1 Querying A Node

```ts
export function ChartRenderer(input: RenderNodeInput): RenderedOutput {
  const { node, context } = input
  const engine = context.engine

  const props = engine.selector.getNodeProps(node.id)
  const bindings = engine.selector.getBindings(node.id)
  const parent = engine.selector.getParent(node.id)

  return <ChartView config={props} bindings={bindings} />
}
```

### 13.2 Dispatching An Action

```ts
function onFilterChange(value: string) {
  const result = context.engine.command({
    type: 'update-props',
    nodeId,
    props: { value, active: true },
  })

  if (!result.ok) {
    showError(result.error)
  }
}
```

### 13.3 Working With Selection

```ts
// Read
const selection = context.engine.selector.getScene().selection?.nodeIds ?? []
const isSelected = selection.includes(node.id)

// Mutate
function selectAllCharts() {
  const charts = context.engine.selector.findNodes(
    (n) => n.type === 'chart'
  )
  context.engine.command({
    type: 'update-selection',
    nodeIds: charts.map((n) => n.id),
  })
}
```

### 13.4 Subscribing To Changes

```ts
const unsub = context.engine.events.on("scene", (scene) => {
  const target = scene.nodes[nodeId]
  if (target) updateUI(target)
})
```

### 13.5 Working With Transactions

```ts
const tx = engine.transaction.begin("user")
engine.command(action1)
engine.command(action2)
const result = engine.transaction.commit(tx)
if (!result.ok) {
  engine.transaction.rollback(tx)
}
```

## 14. Domain Design Principle

The engine uses **domain aggregation** rather than **use-case aggregation**:

- Good: `engine.selector.getNode(id)` — selector belongs to the scene domain
- Bad: `engine.selector.getNode(id)` — flat, invites God Object

This principle constrains the engine's growth. New capabilities are added as
new domain namespaces:

- `engine.scene.*` — everything scene-related (read, write, derive, subscribe)
- `engine.history.*` — undo/redo
- `engine.transaction.*` — multi-action transactions
- `engine.plugins.*` — (future) plugin lifecycle
- `engine.clipboard.*` — (future) clipboard operations
- `engine.state.*` — (future) interaction state management

Each domain is independently testable and can be removed or replaced without
affecting other domains.

## 15. Relationship To Other Specs

- `domain-model.md`: `SceneNode`, `SceneGraph`, `NodeId`, `PageId`,
  `Layout`, `Binding`
- `runtime-engine.md`: `RuntimeAction`, `CommandResult`, command bus
- `history-and-undo-redo.md`: undo/redo contracts, checkpoint semantics
- `plugin-system.md`: `NodeRenderContext`, `Engine` on context
- `component-states.md`: state model, exclusive group semantics
- `computed-state-engine.md`: `ComputedStore` implementation
- `action-registration.md`: handler registration, validate/inverse metadata
- `scheduler.md`: render scheduling after scene changes
- `renderer-contract.md`: renderer access to scene data via selectors
- `data-interaction.md`: `DataInteractionAPI`
- `rich-text.md`: `command.dispatch` for `updateProps`
