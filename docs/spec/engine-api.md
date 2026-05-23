# Engine API

## 1. Scope

This document defines the public API surface exposed by the engine to plugins, components, and the editor shell. Every method that mutates state goes through the command bus. Every method that reads state is pure.

## 2. API Surface

The engine exposes these APIs through `NodeRenderContext`:

```ts
export interface NodeRenderContext {
  selected: boolean
  editable: boolean
  mode: 'editor' | 'runtime'
  engine: EngineAPI
  dataInteraction?: DataInteractionAPI
  stateProps: Record<string, unknown>
}
```

All plugins and components access engine capabilities through `context.engine`.

## 3. EngineAPI

```ts
export interface EngineAPI {
  node: NodeAPI
  scene: SceneAPI
  selection: SelectionAPI
  history: HistoryAPI
  dispatch: DispatchAPI
  states: StateAPI
}
```

### 3.1 NodeAPI

Read-only access to scene node data.

```ts
export interface NodeAPI {
  get(nodeId: NodeId): SceneNode | undefined
  getParent(nodeId: NodeId): SceneNode | undefined
  getChildren(nodeId: NodeId): SceneNode[]
  getProps(nodeId: NodeId): Record<string, unknown>
  getLayout(nodeId: NodeId): Layout | undefined
  getBindings(nodeId: NodeId): Binding[]
  getStyle(nodeId: NodeId): Record<string, unknown>
  isVisible(nodeId: NodeId): boolean
  isLocked(nodeId: NodeId): boolean
  exists(nodeId: NodeId): boolean
}
```

Rules:

1. All methods are pure. They return the current in-memory `SceneGraph` state.
2. `getChildren` returns an empty array for leaf nodes, not `undefined`.
3. `getProps` returns an empty object for nodes with no props.

### 3.2 SceneAPI

Access to active scene-level state.

```ts
export interface SceneAPI {
  getRoot(): SceneNode
  getActivePageId(): PageId
  getSceneVersion(): number
  getAllNodes(): SceneNode[]
  findNodes(predicate: (node: SceneNode) => boolean): SceneNode[]
  findNodeByType(type: string): SceneNode[]
}
```

Rules:

1. `getRoot()` always returns the root node — it exists by invariant.
2. `findNodes` iterates the full node tree. Avoid calling it per-frame in renderers.
3. `findNodeByType` is a convenience wrapper over `findNodes`.

### 3.3 SelectionAPI

Read and update the current selection.

```ts
export interface SelectionAPI {
  getSelection(): NodeId[]
  isSelected(nodeId: NodeId): boolean
  select(nodeIds: NodeId[]): void
  addToSelection(nodeIds: NodeId[]): void
  removeFromSelection(nodeIds: NodeId[]): void
  clearSelection(): void
  selectAll(): void
  selectParent(nodeId: NodeId): void
  selectChildren(nodeId: NodeId): void
}
```

Rules:

1. `select` replaces the current selection with the given node IDs.
2. `addToSelection` appends without removing existing selections.
3. `selectAll` selects every node in the active scene except the root.
4. Selection methods dispatch `update-selection` through the command bus.
5. Selection changes are session-scoped and do not produce durable actions.

### 3.4 HistoryAPI

Access the current undo/redo state.

```ts
export interface HistoryAPI {
  canUndo(): boolean
  canRedo(): boolean
  undo(): void
  redo(): void
  getUndoStackSize(): number
  getRedoStackSize(): number
}
```

Rules:

1. `undo` and `redo` are focus-scoped as defined in `history-and-undo-redo.md` §4.2.
2. Calling `undo` when `canUndo()` is false is a no-op.
3. `getUndoStackSize` is useful for UI indicators; it is not an API contract.

### 3.5 DispatchAPI

Dispatch runtime actions through the command bus.

```ts
export interface DispatchAPI {
  createNode(node: SceneNode, parentId: NodeId, index?: number): DispatchResult
  removeNode(nodeId: NodeId): DispatchResult
  moveNode(nodeId: NodeId, parentId: NodeId, index?: number): DispatchResult
  updateLayout(nodeId: NodeId, layout: Partial<Layout>): DispatchResult
  rotateNode(nodeId: NodeId, rotation: number): DispatchResult
  updateProps(nodeId: NodeId, props: Record<string, unknown>): DispatchResult
  updateStyle(nodeId: NodeId, style: Record<string, unknown>): DispatchResult
  updateBindings(nodeId: NodeId, bindings: Binding[]): DispatchResult
  updateRuntime(nodeId: NodeId, runtime: Record<string, unknown>): DispatchResult
  batch(actions: RuntimeAction[]): DispatchResult
}
```

Rules:

1. Every method dispatches the corresponding `RuntimeAction` through the command bus.
2. The returned `DispatchResult` indicates success or failure.
3. On failure, the scene is unchanged; no partial mutation occurs.
4. `batch` commits all child actions atomically.
5. These methods accept raw values, not action types — the engine wraps them into the correct action type internally.

### 3.6 StateAPI

Activate and deactivate named component states.

```ts
export interface StateAPI {
  setState(nodeId: NodeId, state: string): void
  clearState(nodeId: NodeId, state: string): void
  setExclusive(nodeId: NodeId, state: string, group: string): void
  getActiveStates(nodeId: NodeId): string[]
}
```

See `component-states.md` for the full state model and exclusive group semantics.

Rules:

1. `setState` activates a named state on the target node. If already active, it moves to the end of activation order.
2. `clearState` deactivates a state. If no states remain, props revert to base `node.props`.
3. `setExclusive` activates a state and deactivates it on all other nodes in the same group.
4. `getActiveStates` returns states in activation order.

### 3.7 Subscribing To Scene Changes

Components that need to re-render when scene data changes can subscribe.

```ts
export interface EngineAPI {
  subscribeToNode(
    nodeId: NodeId,
    callback: (node: SceneNode) => void
  ): () => void

  subscribeToScene(
    callback: (scene: SceneGraph) => void
  ): () => void

  subscribeToSelection(
    callback: (nodeIds: NodeId[]) => void
  ): () => void
}
```

Rules:

1. Each `subscribe` method returns an unsubscribe function.
2. Callbacks fire after the command bus processes an action and the scene is updated.
3. Subscriptions are cleaned up when the component unmounts.
4. Plugins may subscribe within their renderer; the engine handles lifecycle.

## 4. Usage In Plugins

### 4.1 Querying A Node

```ts
export function ChartRenderer(input: RenderNodeInput): RenderedOutput {
  const { node, context } = input
  const api = context.engine

  const props = api.node.getProps(node.id)
  const bindings = api.node.getBindings(node.id)
  const parent = api.node.getParent(node.id)

  return <ChartView config={props} bindings={bindings} />
}
```

### 4.2 Dispatching An Action

```ts
// A filter component updates its own props on value change
function onFilterChange(value: string) {
  const result = context.engine.dispatch.updateProps(nodeId, {
    value,
    active: true,
  })

  if (!result.ok) {
    showError(result.error)
  }
}
```

### 4.3 Working With Selection

```ts
// A component that highlights when selected
const isSelected = context.engine.selection.isSelected(node.id)

// A custom toolbar button that selects all chart nodes
function selectAllCharts() {
  const chartNodes = context.engine.scene.findNodeByType('chart')
  context.engine.selection.select(chartNodes.map(n => n.id))
}
```

## 5. Guard Rules

The Engine API enforces these guards at the API boundary:

1. `DispatchAPI` methods validate inputs before constructing the action payload.
2. Node-not-found on any `NodeAPI` method returns `undefined` without throwing.
3. `SelectionAPI` deduplicates `nodeIds` before dispatching.
4. `HistoryAPI` checks `canUndo`/`canRedo` internally; the caller does not need to guard.
5. Subscriptions are debounced to once per frame for UI rendering at the framework level.

## 6. Security Boundaries

Actions that plugins are NOT permitted to call through the Engine API:

1. Plugins may not dispatch `update-selection` directly — use `SelectionAPI` instead.
2. Plugins may not dispatch `remove-node` on a locked node unless the action carries an override flag.
3. Plugins may not read data from pages other than the active page.
4. Plugins may not subscribe to document-level changes — only scene-level subscriptions are exposed.

## 7. Relationship To Other Specs

- `domain-model.md`: `SceneNode`, `SceneGraph`, `NodeId`, `PageId`, `Layout`, `Binding`
- `runtime-engine.md`: `RuntimeAction`, `DispatchResult`, command bus
- `history-and-undo-redo.md`: undo/redo contracts
- `plugin-system.md`: `NodeRenderContext`, `Renderer`
- `domain-model.md`: `SceneNode`, `SceneGraph`, `NodeId`, `PageId`, `Layout`, `Binding`
- `data-interaction.md`: `DataInteractionAPI`
