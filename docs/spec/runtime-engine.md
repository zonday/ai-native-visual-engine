# Runtime Engine

## 1. Scope

This document defines the scene-level runtime mutation model used by editor interactions, AI compilation output, history, and collaboration.

Document-level mutations use the parallel model defined in `document-runtime.md`.

## 2. Runtime Action Principles

Every runtime action must satisfy the following properties:

1. Deterministic
   Given the same input state and action payload, the result must be identical.

2. Replayable
   The action can be re-applied in sequence to reconstruct state.

3. Reversible
   The system can derive or store enough information to undo the mutation.

4. Atomic
   Either the action fully applies or it does not apply at all.

5. Serializable
   The action payload must be serializable for history, persistence, and collaboration transport.

Runtime commit policy:

1. Invalid scene mutations are rejected at commit time by default.
2. Runtime handlers must not perform non-deterministic geometric auto-repair.
3. Only explicitly documented normalization rules may adjust input during commit.

## 3. Runtime Action Types

```ts
export type RuntimeAction =
  | CreateNodeAction
  | RemoveNodeAction
  | MoveNodeAction
  | UpdateLayoutAction
  | RotateNodeAction
  | UpdatePropsAction
  | UpdateStyleAction
  | UpdateBindingsAction
  | UpdateRuntimeAction
  | UpdateSelectionAction
  | BatchActions
```

### 3.1 create-node

```ts
export interface CreateNodeAction {
  type: 'create-node'
  node: SceneNode
  parentId: NodeId
  index?: number
}
```

Behavior:

1. Inserts `node` into `nodes`.
2. Inserts `node.id` into parent `children[]`.
3. Sets `node.parentId = parentId` in normalized form.
4. Fails if parent does not exist or node ID already exists.
5. If `index` is omitted, appends to the end. Clamps `index` to `[0, children.length]`; out-of-bounds values append.

### 3.2 remove-node

```ts
export interface RemoveNodeAction {
  type: 'remove-node'
  nodeId: NodeId
}
```

Behavior:

1. Removes target node and all descendants.
2. Removes target ID from parent `children[]`.
3. Fails if target is root.

### 3.3 move-node

```ts
export interface MoveNodeAction {
  type: 'move-node'
  nodeId: NodeId
  parentId: NodeId
  index?: number
}
```

Behavior:

1. Removes node from old parent ordering.
2. Inserts node into new parent ordering.
3. Updates `parentId`.
4. Fails if target node does not exist.
5. Fails if new parent does not exist.
6. Fails if move would create a cycle.
7. If `index` is omitted, appends to the end. Clamps `index` to `[0, children.length]`; out-of-bounds values append.

### 3.4 update-layout

```ts
export interface UpdateLayoutAction {
  type: 'update-layout'
  nodeId: NodeId
  layout: Partial<Layout>
}
```

Behavior:

1. Merges layout fields onto existing layout or creates one if permitted.
2. Must pass layout validation after merge.
3. Must reject invalid geometry rather than auto-repairing it, unless a deterministic normalization rule is explicitly documented for that field.

### 3.5 rotate-node

```ts
export interface RotateNodeAction {
  type: 'rotate-node'
  nodeId: NodeId
  rotation: number
}
```

Behavior:

1. `rotation` is expressed in degrees.
2. The current spec stores canonical rotation at `AbsoluteLayout.rotation`.
3. The current rotate behavior applies only to nodes using `absolute` layout mode and plugins whose capabilities allow rotation.
4. Must normalize rotation into the canonical interval `[0, 360)` before storage.
5. Rotation must use `rotate-node` as the canonical mutation path; `update-layout` must not be used for rotation updates.
6. Must reject the action with a deterministic runtime error when the target node uses a non-`absolute` layout mode, when the plugin does not allow rotation, or when the node does not exist.

### 3.6 update-props

```ts
export interface UpdatePropsAction {
  type: 'update-props'
  nodeId: NodeId
  props: Record<string, unknown>
}
```

Behavior:

1. Shallow-merges provided props by default.
2. If a plugin requires replace semantics for specific props, that rule must be declared in plugin metadata.

### 3.7 update-style

```ts
export interface UpdateStyleAction {
  type: 'update-style'
  nodeId: NodeId
  style: Record<string, unknown>
}
```

Behavior:

1. Replaces the entire style object on the target node.
2. Differs from `update-props` which shallow-merges; `update-style` uses replace semantics because styles are a flat token map.

### 3.8 update-bindings

```ts
export interface UpdateBindingsAction {
  type: 'update-bindings'
  nodeId: NodeId
  bindings: Binding[]
}
```

Behavior:

1. Replaces all bindings on the target node.

### 3.9 update-runtime

```ts
export interface UpdateRuntimeAction {
  type: 'update-runtime'
  nodeId: NodeId
  runtime: Record<string, unknown>
}
```

Behavior:

1. Shallow-merges provided runtime state onto the target node.

### 3.10 update-selection

```ts
export interface UpdateSelectionAction {
  type: 'update-selection'
  nodeIds: NodeId[]
}
```

`update-selection` is session-scoped by default.

Rules:

1. It updates the in-memory active `SceneGraph`.
2. `nodeIds` must not contain duplicates; handlers must reject the action if duplicates are provided.
3. Provided order is preserved as the canonical selection ordering.
4. It is excluded from `SceneEventLog` by default.
5. It is excluded from durable collaborative sync by default.
6. Editors may keep a transient local selection history, but it does not participate in durable content undo and redo.
7. It must not bump persisted scene `version`.
8. It must not mutate `PersistedSceneGraph` content fields.

### 3.11 batch-actions

```ts
export interface BatchActions {
  type: 'batch-actions'
  actions: RuntimeAction[]
}
```

Behavior:

1. Executes child actions in order.
2. Commits as one history entry.
3. Must rollback entirely if any child action fails.
4. Nested batch actions are flattened before execution; the self-referencing type exists for composability, not for unbounded nesting.

### 3.12 Transaction Lifecycle

`batch-actions` (§3.11) is a building block. The **Transaction** system is the full lifecycle wrapper around one or more actions.

A Transaction is not an action type — it is an execution context that wraps a group of actions with a begin/commit/rollback lifecycle.

#### 3.12.1 RuntimeTransaction

```ts
export interface RuntimeTransaction {
  id: string
  timestamp: number
  source: 'user' | 'ai' | 'system'
  actions: RuntimeAction[]
  inverseActions?: RuntimeAction[]
  affectedNodes: NodeId[]
  metadata?: Record<string, unknown>
}
```

Fields:

| Field | Description |
|------|------|
| `id` | Unique transaction ID (UUID) |
| `timestamp` | Epoch ms when the transaction began |
| `source` | Origin of the transaction — `'user'` for direct UI interaction, `'ai'` for compiler output, `'system'` for internal/collaboration |
| `actions` | Ordered list of child actions |
| `inverseActions` | Computed inverse actions for undo (populated on commit) |
| `affectedNodes` | Set of node IDs touched by any child action |
| `metadata` | Optional extensible metadata (e.g., `{ aiPrompt, confidence }`) |

#### 3.12.2 Transaction Lifecycle

Every transaction follows this lifecycle:

```text
beginTransaction()
  └── applyActions()       — execute each child action in order
  └── validate()           — validate post-condition state
  └── collectAffectedNodes()  — gather all touched node IDs
  └── computeDerivedState()   — recompute derived/inferred state
  └── emitEvents()            — fire scene-changed events
  └── createInverseActions()  — compute inverse for each action (reversed)
  └── pushHistory()           — append to transaction log
commitTransaction()

On failure at any step:
rollbackTransaction()  — restore pre-transaction state
```

Steps:

1. **beginTransaction**: Allocate transaction ID, capture pre-state snapshot.
2. **applyActions**: Execute each `RuntimeAction` via the handler registry in order. Each action validates its own preconditions.
3. **validate**: Post-state validation (constraint checks, referential integrity). If any constraint fails, rollback.
4. **collectAffectedNodes**: Walk all child actions and build a deduplicated set of every `nodeId` referenced by any action. This set feeds into scheduler, computed properties, and render invalidation.
5. **computeDerivedState**: Recompute any derived scene state (auto-layout, constraint-satisfied positions, binding-resolved values). This step is optional for simple transactions.
6. **emitEvents**: Notify subscribers (renderer, devtools, collaboration) with the affected node set and new scene snapshot.
7. **createInverseActions**: For each child action, compute the inverse action and collect them in reverse order. Store as `inverseActions` on the transaction.
8. **pushHistory**: Append the transaction to the undo stack. The undo stack stores transactions, not individual actions.
9. **commitTransaction**: Freeze the transaction, mark it committed. The scene version is bumped once per transaction.

#### 3.12.3 TransactionManager

```ts
export interface TransactionManager<TState, TAction> {
  begin(source: TransactionSource, metadata?: Record<string, unknown>): TransactionContext<TAction>
  commit(context: TransactionContext<TAction>): TransactionResult<TState>
  rollback(context: TransactionContext<TAction>): TState
}

export interface TransactionContext<TAction> {
  tx: RuntimeTransaction  // or DocumentTransaction
  preState: TState
  postState?: TState
  rollbackState?: TState
}

export interface TransactionResult<TState> {
  ok: boolean
  state: TState
  tx: RuntimeTransaction  // committed or failed
  error?: RuntimeError
}
```

#### 3.12.4 Source Tracking

Every transaction carries a `source` field:

- `'user'`: Created by direct editor interaction (drag, click, keyboard shortcut)
- `'ai'`: Created by the AI compiler pipeline
- `'system'`: Created by collaboration sync, internal scheduler, or recovery

The source field is used by history filters (e.g., "undo only AI actions") and collaboration conflict resolution.

#### 3.12.5 Nested Transactions

Transactions can be nested. A nested transaction shares its parent's `id` prefix.

```text
Transaction A (source: 'ai')
  ├── Sub-transaction A.1 (source: 'ai', layout phase)
  └── Sub-transaction A.2 (source: 'ai', style phase)
```

Nested transaction rules:

1. A nested transaction's `id` is `${parentId}.${increment}`.
2. Rolling back a parent transaction cascades to all children.
3. Committing a nested transaction does not push to history or bump version — only the root transaction does.
4. If a nested transaction fails, the parent must either retry or rollback.
5. Middleware sees the root transaction; nested transaction boundaries are transparent to middleware.

#### 3.12.6 Transaction vs Batch

| | `batch-actions` | Transaction |
|--|------|------|
| Scope | One action type | Full lifecycle wrapper |
| Lifecycle | Apply + inverse only | begin/validate/commit/rollback |
| Source tracking | None | `'user' \| 'ai' \| 'system'` |
| affectedNodes | Not collected | Collected and exposed |
| Derived state | Not computed | Optional computeDerivedState step |
| History unit | Single history entry | Transaction log entry |
| Nesting | Flattened (no nesting) | Supported via sub-transaction |

#### 3.12.7 Migration Path

Existing `batch-actions` handling is preserved. New code should use `TransactionManager`:

1. `batch-actions` handler is internally backed by `TransactionManager.begin()` + `.commit()`.
2. Editor integrations that call `batch()` via `DispatchAPI` automatically get the full transaction lifecycle.
3. AI compiler uses `TransactionManager` directly to set `source: 'ai'` and attach metadata.

## 4. Command Bus

```ts
export interface CommandBus {
  dispatch(action: RuntimeAction): DispatchResult
}

export interface DispatchResult {
  ok: boolean
  scene: SceneGraph
  error?: RuntimeError
}
```

Responsibilities:

1. Accept runtime actions from editor UI, compiler output, or collaboration sync.
2. Pass action through middleware chain.
3. Route action to the correct handler.
4. Return updated scene or structured failure.

## 5. Handler Registry

```ts
export type RuntimeHandler<TAction extends RuntimeAction> = (
  scene: SceneGraph,
  action: TAction,
  context: RuntimeContext
) => SceneGraph

export interface RuntimeContext {
  now: () => number
  actorId?: string
  registry: PluginRegistry
}
```

Example registry:

```ts
export const runtimeHandlers = {
  'create-node': createNodeHandler,
  'remove-node': removeNodeHandler,
  'move-node': moveNodeHandler,
  'update-layout': updateLayoutHandler,
  'rotate-node': rotateNodeHandler,
  'update-props': updatePropsHandler,
  'update-style': updateStyleHandler,
  'update-bindings': updateBindingsHandler,
  'update-runtime': updateRuntimeHandler,
  'update-selection': updateSelectionHandler,
  'batch-actions': batchActionsHandler,
}
```

## 6. applyAction Contract

```ts
export function applyAction(
  scene: SceneGraph,
  action: RuntimeAction,
  context: RuntimeContext
): SceneGraph {
  const handler = runtimeHandlers[action.type]
  if (!handler) {
    throw new Error(`Unknown action: ${action.type}`)
  }
  return handler(scene, action as never, context)
}
```

Contract rules:

1. Handlers must be pure relative to input state.
2. Handlers must return a new valid scene.
3. Handlers must not perform side effects such as logging, persistence, or network sync.
4. Side effects belong in middleware.

## 7. Middleware Pipeline

Recommended pipeline:

```text
Action
  -> Logger
  -> Validator
  -> Undo/History
  -> Collaboration
  -> Handler
```

### 7.1 Logger Middleware

Responsibilities:

1. Record incoming actions and result status.
2. Emit devtools or telemetry events.
3. Never mutate payload semantics.

### 7.2 Validator Middleware

Responsibilities:

1. Validate action schema.
2. Validate scene preconditions.
3. Check structural and plugin constraints.
4. Reject invalid actions before mutation.

### 7.3 Undo Middleware

Responsibilities:

1. Build inverse action or store prior snapshot diff.
2. Append history entry only on successful commit.
3. Clear redo stack when a new forward mutation occurs.

### 7.4 Collaboration Middleware

Responsibilities:

1. Transform or package committed actions for remote sync.
2. Integrate with CRDT or OT layer.
3. Preserve local deterministic scene result.

## 8. History Model

History stores committed **transactions**, not individual actions.

```ts
export interface HistoryState<TAction> {
  undoStack: TransactionEntry<TAction>[]
  redoStack: TransactionEntry<TAction>[]
  maxStackSize: number
}

export interface TransactionEntry<TAction> {
  tx: RuntimeTransaction  | DocumentTransaction  // generic transaction
  timestamp: number
  actorId?: string
}
```

Each `TransactionEntry` wraps a fully committed transaction with its pre-computed `inverseActions`. Undo/redo operates at transaction granularity.

Rules:

1. `undo` applies all `inverseActions` in the transaction in order.
2. `redo` reapplies all `actions` in the transaction in order.
3. A transaction is the smallest undoable unit. A single user gesture (drag, AI generate, paste) produces exactly one transaction.
4. Selection-only actions are excluded from transactions and use a separate transient history policy.
5. Collaborative undo and redo operate on each actor's own committed transactions only.
6. Remote committed transactions do not enter the local actor's undo stack.
7. The `source` field on the transaction enables filtered history views (e.g., "undo only AI transactions").
8. The maximum undo stack is bounded at 200 entries. When exceeded, the oldest entries are evicted.

## 9. Event Sourcing

Preferred persistence model:

1. Store initial scene snapshot.
2. Append runtime action log.
3. Rebuild scene via replay.

Benefits:

- undo and redo compatibility
- collaboration-friendly transport
- auditability
- time-travel debugging

Minimum replay contract:

```ts
export interface SceneEventLogEntry {
  action: RuntimeAction
  actorId?: string
  timestamp: number
}

export interface SceneEventLog {
  initialScene: PersistedSceneGraph
  actions: SceneEventLogEntry[]
}
```

Rules:

1. `SceneEventLog` stores content mutations only.
2. `SceneEventLog.actions` must not contain session-scoped actions such as `update-selection`.
3. If the runtime action surface expands with additional session-only actions, they are also excluded from `SceneEventLog.actions` unless explicitly reclassified as durable content mutations.
4. The persisted replay root should normally be `PersistedSceneGraph`; an editor may materialize that snapshot into an in-memory `SceneGraph` when a page becomes active.

## 10. Failure Policy

Runtime failure must be explicit.

```ts
export interface RuntimeError {
  code: string
  message: string
  actionType?: string
  nodeId?: NodeId
}
```

Rules:

1. Unknown action types fail fast.
2. Invalid payloads fail validation.
3. Handler failures must not partially mutate scene state.
4. Middleware may annotate errors but must preserve failure semantics.

## 11. Boundary With Document Runtime

Use scene runtime actions for:

- node CRUD
- layout updates
- props and style updates
- active-scene selection updates

Use document actions for:

- page create and remove
- page reorder
- page rename
- page route updates

The semantic compiler may emit both action kinds in one execution plan, but they must remain distinct runtime domains.

## 12. Selector System

Defined in `selector-system.md`. The selector system provides unified, memoized read access to `SceneGraph`:

- `getNode`, `getChildren`, `getParent`, `getRoot` — basic node accessors
- `getAncestors`, `getDescendants`, `isDescendantOf` — hierarchy queries
- `getVisibleNodes` — visibility filtering

**All business logic must read scene data through selectors.** Direct `scene.nodes[id]` is permitted only inside selector implementations.

## 13. Computed State Engine

Defined in `computed-state-engine.md`. Computes derived state without writing back to `SceneGraph`:

- `getWorldTransform` — accumulated position/rotation from root
- `getComputedBounds` — absolute bounding box
- `getVisibleBounds` — visible bounding box (clipped)

The computed engine reads exclusively through `SelectorRegistry` and is invalidated through the scheduler.

## 14. Scheduler

Defined in `scheduler.md`. Orchestrates the mutation → compute → render pipeline:

- `markDirty(nodeIds)` after transaction commit
- Batched compute phase (lazy recomputation)
- Renderer-agnostic event emission
- `sync` mode for testing, `async` mode (rAF) for production

## 15. Runtime Architecture Diagram

```
Semantic Intent
  │
  ▼
compileSemanticAction()
  │
  ▼
ExecutionPlan { documentActions, runtimeActions }
  │
  ├─ documentActions ──► documentBus ──► DocumentMutation
  │
  └─ runtimeActions ──► TransactionManager.begin('ai')
                          │
                          ▼
                      applyAction(tx, action)
                          │ (per action)
                          ▼
                      commandBus.dispatch(action)
                          │
                          ├─ validator middleware
                          ├─ constraint middleware
                          ├─ handler ──► scene mutation
                          └─ history middleware (skipped in tx)
                          │
                          ▼
                      commit(tx) ──► compute inverses
                          │
                          ├─ scheduler.markDirty(affectedNodes)
                          ├─ scheduler.flush()
                          │    ├─ compute phase (invalidate computed state)
                          │    └─ render phase (notify subscribers)
                          └─ pushUndoTransaction(actions, inverses)
```
