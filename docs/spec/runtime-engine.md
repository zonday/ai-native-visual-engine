# Runtime Engine

## 1. Scope

This document defines the runtime mutation model used by editor interactions, AI compilation output, history, and collaboration.

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

## 3. Runtime Action Types

```ts
export type RuntimeAction =
  | CreateNodeAction
  | RemoveNodeAction
  | MoveNodeAction
  | UpdateLayoutAction
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

### 3.5 update-props

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

### 3.6 update-style

```ts
export interface UpdateStyleAction {
  type: 'update-style'
  nodeId: NodeId
  style: Record<string, unknown>
}
```

### 3.7 update-selection

```ts
export interface UpdateSelectionAction {
  type: 'update-selection'
  nodeIds: NodeId[]
}
```

This action may be excluded from persisted event sourcing depending on product policy. The engine must support both persisted and session-only history modes.

### 3.8 batch-actions

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
4. Selection-only actions may use separate history policy.

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
  initialScene: SceneGraph
  actions: RuntimeAction[]
}
```

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
