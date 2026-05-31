# Engine API

## 1. Scope

This document defines the public API surface exposed by the engine to plugins,
components, and the editor shell. Every method that mutates state goes through
the command bus. Every method that reads state is pure.

## 2. Architecture

The engine exposes a **Facade** that delegates to independent services:

```
EngineFacade
├── query: QueryService
│   ├── node: NodeQuery
│   ├── scene: SceneQuery
│   └── selection: SelectionQuery
├── command: CommandService
├── history: HistoryService
├── transaction: TransactionService
├── states: StateService
├── events: EventBus
├── selector: SelectorAPI
└── computed: ComputedStateAPI
```

Data flow for mutations:

```
Plugin/Component
  → CommandService.dispatch()
  → CommandBus.middleware[]
  → Handler (with validation)
  → TransactionManager (computes inverses)
  → EventBus (via CommandBus.onCommitted)
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

## 4. EngineFacade

The top-level composition root. Every plugin accesses engine capabilities
through the facade on `NodeRenderContext.engine`.

```ts
export interface EngineFacade {
  query: QueryService
  command: CommandService
  history: HistoryService
  transaction: TransactionService
  states: StateService
  events: EventBus
  selector: SelectorAPI
  computed: ComputedStateAPI
}
```

Rules:

1. The facade holds no state — it is a grouping of independent services.
2. All services are injectable. The facade is assembled in the engine bootstrap.
3. The facade does not perform validation, notification, or error translation.
   These are handled by lower layers (handlers, middleware, EventBus).

## 5. QueryService

Read-only access to scene data. Every method returns a frozen or
`Readonly<T>` view. No mutation methods exist here.

```ts
export interface QueryService {
  node: NodeQuery
  scene: SceneQuery
  selection: SelectionQuery
}
```

### 5.1 NodeQuery

```ts
export interface NodeQuery {
  get(nodeId: NodeId): Readonly<SceneNode> | undefined
  getParent(nodeId: NodeId): Readonly<SceneNode> | undefined
  getChildren(nodeId: NodeId): ReadonlyArray<Readonly<SceneNode>>
  getProps(nodeId: NodeId): Readonly<Record<string, unknown>>
  getLayout(nodeId: NodeId): Readonly<Layout> | undefined
  getBindings(nodeId: NodeId): ReadonlyArray<Readonly<Binding>>
  getStyle(nodeId: NodeId): Readonly<Record<string, unknown>>
  isVisible(nodeId: NodeId): boolean
  isLocked(nodeId: NodeId): boolean
  exists(nodeId: NodeId): boolean
}
```

Rules:

1. All methods are pure. They return a view of the current `SceneGraph`.
2. Returned objects are shallow-frozen or typed as `Readonly<T>` to prevent
   accidental mutation by consumers.
3. `getChildren` returns an empty array for leaf nodes, not `undefined`.
4. `getProps` returns an empty object for nodes with no props.
5. Node-not-found on any `get*` method returns `undefined` or empty value —
   never throws.

### 5.2 SceneQuery

```ts
export interface SceneQuery {
  getRoot(): Readonly<SceneNode>
  getActivePageId(): PageId
  getSceneVersion(): number
  getAllNodes(): ReadonlyArray<Readonly<SceneNode>>
  findNodes(
    predicate: (node: Readonly<SceneNode>) => boolean
  ): ReadonlyArray<Readonly<SceneNode>>
  findNodeByType(type: string): ReadonlyArray<Readonly<SceneNode>>
}
```

Rules:

1. `getRoot()` always returns the root node — it exists by invariant.
2. `findNodes` iterates the full node tree. Avoid calling it per-frame in renderers.
3. `findNodeByType` is a convenience wrapper over `findNodes`.

### 5.3 SelectionQuery

```ts
export interface SelectionQuery {
  getSelection(): ReadonlyArray<NodeId>
  isSelected(nodeId: NodeId): boolean
}
```

## 6. CommandService

Pure dispatch. No validation or notification logic lives here — those are
delegated to handlers (validation) and EventBus (notification).

```ts
export interface CommandService {
  dispatch(action: RuntimeAction): CommandResult
}
```

Rules:

1. `dispatch` constructs an implicit single-action transaction,
   dispatches through the CommandBus, and returns `CommandResult`.
2. Validation is performed by the handler's `validate` function and
   by middleware — the API layer does not duplicate these checks.
3. On success, the CommandBus emits `onCommitted` internally. The EventBus
   reacts to this lifecycle event and notifies subscribers — `CommandService`
   does not call `notify` itself.
4. On failure, the scene is unchanged and the error carries a machine-readable
   code.

## 7. HistoryService

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
   reacting to `CommandBus.onCommitted`, not by the HistoryService itself.

## 8. TransactionService

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

1. `begin` captures the current pre-state.
2. `applyAction` applies one action within the transaction. The action is
   validated by the handler before mutation.
3. `commit` runs the full lifecycle: compute inverse actions, push history
   entry, emit `onCommitted`. The EventBus notifies subscribers.
4. `rollback` restores the pre-state without notification.
5. When no explicit transaction is open, single-action dispatches create
   an implicit transaction.

Usage by the AI compiler:

```ts
const tx = engine.transaction.begin('ai', { prompt, confidence: 0.95 })
engine.command.dispatch(createNodeAction(header, root))
engine.command.dispatch(createNodeAction(image, root))
engine.command.dispatch(createNodeAction(title, root))
const result = engine.transaction.commit(tx)
if (!result.ok) {
  engine.transaction.rollback(tx)
}
```

## 9. StateService

Component state management. Internally produces a `StateAction` that the
state machine translates into `RuntimeAction`. Consumers never construct
`RuntimeAction` directly.

```ts
export interface StateService {
  setState(nodeId: NodeId, state: string): CommandResult
  clearState(nodeId: NodeId, state: string): CommandResult
  setExclusive(
    nodeId: NodeId,
    state: string,
    group: string
  ): CommandResult
  getActiveStates(nodeId: NodeId): ReadonlyArray<string>
}
```

Rules:

1. `setState` activates a named state on the target node. If already active,
   it moves to the end of activation order.
2. `clearState` deactivates a state. If no states remain, props revert to
   base `node.props`.
3. `setExclusive` activates a state and deactivates it on all other nodes
   in the same exclusive group. The exclusive-group index is maintained
   internally as `Map<GroupId, NodeId>` — O(1) lookup, not a full scene scan.
4. `getActiveStates` returns states in activation order.
5. The `StateService` translates calls into `RuntimeAction` internally.
   Plugin code never constructs `update-runtime` actions directly.

See `component-states.md` for the full state model and exclusive group
semantics.

## 10. EventBus

Central notification hub. Hooks into the CommandBus lifecycle
(`onCommitted`, `onRolledBack`) so that all downstream consumers
receive events from a single source.

```ts
export interface EventBus {
  subscribeToScene(
    callback: (scene: SceneGraph) => void
  ): () => void
  subscribeToSelection(
    callback: (nodeIds: NodeId[]) => void
  ): () => void
}
```

Rules:

1. Each subscribe method returns an unsubscribe function.
2. Callbacks fire after the CommandBus processes a committed action
   — never during a rollback or partial apply.
3. Notifications are coalesced using a microtask-based scheduler.
   Multiple dispatches in the same microtask produce a single notification
   with the final state. This is an explicit design choice, not a side effect.
4. `subscribeToNode` does not exist. Consumers that need per-node
   reactivity should use `subscribeToScene` with a selector to extract
   the desired node. The selector system (see `SelectorAPI`) provides
   memoized access.
5. Subscriptions are cleaned up when the component unmounts.

Internal EventBus contract (not exposed to plugins):

```ts
// Internal — the CommandBus emits these after each committed action
interface CommandBusLifecycle {
  onCommitted(action: RuntimeAction): void
  onRolledBack(action: RuntimeAction): void
}
```

## 11. SelectorAPI

Reactive, memoized read access to `SceneGraph`. Backed by `SelectorRegistry` — a signal-based query layer with field-level dependency tracking. See `selector-system.md` for the full spec.

```ts
export interface SelectorAPI {
  getNode(nodeId: NodeId): SceneNode | undefined
  getChildren(nodeId: NodeId): SceneNode[]
  getParent(nodeId: NodeId): SceneNode | undefined
  getRoot(): SceneNode
  getAncestors(nodeId: NodeId): SceneNode[]
  getDescendants(nodeId: NodeId): SceneNode[]
  getVisibleNodes(): SceneNode[]
}
```

Rules:

1. Selectors are memoized by `scene.version`. Repeated calls with the same scene return cached results.
2. Selectors use field-level signal tracking. A `getNodeProps(id)` call only subscribes to the `props` signal of that node — changes to `layout` or `children` do not invalidate.
3. Selectors never mutate state.
4. All renderers and plugins should prefer selectors over direct `QueryService` methods for repeated reads during rendering.

## 12. ComputedStateAPI

Derived state computation. See `computed-state-engine.md` for the full spec.

```ts
export interface ComputedStateAPI {
  getWorldTransform(nodeId: NodeId): WorldTransform
  getComputedBounds(nodeId: NodeId): ComputedBounds
  getVisibleBounds(nodeId: NodeId): ComputedBounds | null
  getCenter(nodeId: NodeId): { x: number; y: number }
}
```

Rules:

1. Computed state is invalidated through the scheduler after each
   transaction commit.
2. Computed state never writes back to `SceneGraph`.
3. Repeated reads of the same value with no intermediate scene change
   return cached results.

## 13. Usage In Plugins

### 13.1 Querying A Node

```ts
export function ChartRenderer(input: RenderNodeInput): RenderedOutput {
  const { node, context } = input
  const api = context.engine

  const props = api.query.node.getProps(node.id)
  const bindings = api.query.node.getBindings(node.id)
  const parent = api.query.node.getParent(node.id)

  return <ChartView config={props} bindings={bindings} />
}
```

### 13.2 Dispatching An Action

```ts
function onFilterChange(value: string) {
  const result = context.engine.command.dispatch({
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
const isSelected = context.engine.query.selection.isSelected(node.id)

function selectAllCharts() {
  const charts = context.engine.query.scene.findNodeByType('chart')
  context.engine.query.selection // ERROR — SelectionQuery is read-only
}
```

Selection mutation happens through CommandService:

```ts
function selectAllCharts() {
  const chartNodes = context.engine.query.scene.findNodeByType('chart')
  const ids = chartNodes.map((n) => n.id)
  context.engine.command.dispatch({ type: 'update-selection', nodeIds: ids })
}
```

### 13.4 Managing Component State

```ts
function onTabClick(tabId: string, group: string) {
  context.engine.states.setExclusive(tabId, 'selected', group)
}
```

### 13.5 Subscribing To Changes

```ts
const unsub = context.engine.events.subscribeToScene((scene) => {
  const target = scene.nodes[nodeId]
  if (target) updateUI(target)
})
```

## 14. Guard Rules

The engine enforces these guards at the API boundary:

1. Validation is owned by handler `validate` functions and middleware.
   The API layer does not duplicate validation checks.
2. Node-not-found on any `NodeQuery` method returns `undefined` without
   throwing.
3. `SelectionQuery` is read-only. Selection mutation must go through
   `CommandService.dispatch`.
4. HistoryService guards `undo`/`redo` internally — if the stack is empty,
   the call is a no-op (`ok: false`).
5. Subscriptions are coalesced to once per microtask for UI rendering.
6. All mutation methods return `CommandResult`. No mutation method returns
   `void`.
7. The `StateService` is the only layer that may construct `RuntimeAction`
   for state management. Plugin code must not construct `update-runtime`
   actions directly.

Guards that were previously in the Engine API layer and are now removed:

| Removed Guard | Responsible Layer |
|---|---|
| `scene.invalid-parent` check | Handler `validate` function |
| `scene.node-not-found` check | Handler `validate` function |
| `scene.locked` check | Middleware or handler |

## 15. Security Boundaries

Actions that plugins are NOT permitted to call through the engine:

1. Plugins may not dispatch `update-selection` directly — use
   `CommandService.dispatch({ type: 'update-selection' })` with the
   appropriate node IDs.
2. Plugins may not dispatch `remove-node` on a locked node unless the
   action carries an override flag (enforced by middleware).
3. Plugins may not read data from pages other than the active page.
4. Plugins may not subscribe to document-level changes — only scene-level
   subscriptions are exposed through `EventBus`.

## 16. Relationship To Other Specs

- `domain-model.md`: `SceneNode`, `SceneGraph`, `NodeId`, `PageId`,
  `Layout`, `Binding`
- `runtime-engine.md`: `RuntimeAction`, `CommandResult`, command bus
- `history-and-undo-redo.md`: undo/redo contracts, checkpoint semantics
- `plugin-system.md`: `NodeRenderContext`, `EngineFacade` on context
- `component-states.md`: state model, exclusive group semantics, `StateService`
- `selector-system.md`: `SelectorAPI` implementation
- `computed-state-engine.md`: `ComputedStateAPI` implementation
- `action-registration.md`: handler registration, validate/inverse metadata
- `scheduler.md`: render scheduling after scene changes
- `renderer-contract.md`: renderer access to scene data via selectors
- `data-interaction.md`: `DataInteractionAPI`
- `rich-text.md`: `command.dispatch` for `updateProps`
