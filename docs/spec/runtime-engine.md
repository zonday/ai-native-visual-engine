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
3. Fails if target is root unless a dedicated root-replacement action exists.

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
4. Fails if move would create a cycle.

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
3. must reject invalid geometry rather than auto-repairing it, unless a deterministic normalization rule is explicitly documented for that field

### 3.5 rotate-node

```ts
export interface RotateNodeAction {
  type: 'rotate-node'
  nodeId: NodeId
  rotation: number
}
```

Behavior:

1. `rotation` is expressed in degrees
2. v1 stores canonical rotation at `AbsoluteLayout.rotation`
3. v1 is valid only for nodes using `absolute` layout mode and plugins whose capabilities allow rotation
4. must normalize rotation into the canonical interval `[0, 360)` before storage
5. rotation must use `rotate-node` as the canonical mutation path; `update-layout` must not be used for rotation updates

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

### 3.8 update-selection

```ts
export interface UpdateSelectionAction {
  type: 'update-selection'
  nodeIds: NodeId[]
}
```

`update-selection` is session-scoped by default.

Rules:

1. it updates the in-memory active `SceneGraph`
2. `nodeIds` must not contain duplicates; handlers must reject the action if duplicates are provided
3. provided order is preserved as the canonical selection ordering
4. it is excluded from `SceneEventLog` by default
5. it is excluded from durable collaborative sync by default
6. editors may keep a transient local selection history, but it does not participate in durable content undo and redo
7. it must not bump persisted scene `version`
8. it must not mutate `PersistedSceneGraph` content fields

### 3.9 batch-actions

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

```ts
export interface HistoryState {
  undoStack: HistoryEntry[]
  redoStack: HistoryEntry[]
}

export interface HistoryEntry {
  action: RuntimeAction
  inverseAction?: RuntimeAction
  timestamp: number
  actorId?: string
}
```

Rules:

1. `undo` applies `inverseAction` if available.
2. Complex actions should prefer explicit inverse actions over full snapshots when feasible.
3. For actions whose inverse cannot be represented compactly, history may store structural patch metadata.
4. Selection-only actions use a separate transient history policy and are excluded from durable content history by default.
5. collaborative undo and redo operate on each actor's own durable actions only.
6. remote durable actions do not enter the local actor's undo stack.

## 9. Event Sourcing

Preferred persistence model:

1. store initial scene snapshot
2. append runtime action log
3. rebuild scene via replay

Benefits:

- undo and redo compatibility
- collaboration-friendly transport
- auditability
- time-travel debugging

Minimum replay contract:

```ts
export interface SceneEventLog {
  initialScene: PersistedSceneGraph
  actions: RuntimeAction[]
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
