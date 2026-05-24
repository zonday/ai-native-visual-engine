import type { SceneNode, SceneGraph, NodeId, PageId, Layout, Binding } from "./types.js";
import type { RuntimeAction } from "./runtime/actions.js";
import type { DispatchResult, CommandBus } from "./runtime/command-bus.js";
import type { RuntimeHistoryState } from "./runtime/history.js";
import { undoRuntimeAction, redoRuntimeAction } from "./runtime/history.js";

export interface NodeAPI {
  get(nodeId: NodeId): SceneNode | undefined;
  getParent(nodeId: NodeId): SceneNode | undefined;
  getChildren(nodeId: NodeId): SceneNode[];
  getProps(nodeId: NodeId): Record<string, unknown>;
  getLayout(nodeId: NodeId): Layout | undefined;
  getBindings(nodeId: NodeId): Binding[];
  getStyle(nodeId: NodeId): Record<string, unknown>;
  isVisible(nodeId: NodeId): boolean;
  isLocked(nodeId: NodeId): boolean;
  exists(nodeId: NodeId): boolean;
}

export interface SceneAPI {
  getRoot(): SceneNode;
  getActivePageId(): PageId;
  getSceneVersion(): number;
  getAllNodes(): SceneNode[];
  findNodes(predicate: (node: SceneNode) => boolean): SceneNode[];
  findNodeByType(type: string): SceneNode[];
}

export interface SelectionAPI {
  getSelection(): NodeId[];
  isSelected(nodeId: NodeId): boolean;
  select(nodeIds: NodeId[]): void;
  addToSelection(nodeIds: NodeId[]): void;
  removeFromSelection(nodeIds: NodeId[]): void;
  clearSelection(): void;
  selectAll(): void;
  selectParent(nodeId: NodeId): void;
  selectChildren(nodeId: NodeId): void;
}

export interface HistoryAPI {
  canUndo(): boolean;
  canRedo(): boolean;
  undo(): void;
  redo(): void;
  getUndoStackSize(): number;
  getRedoStackSize(): number;
}

export interface DispatchAPI {
  createNode(node: SceneNode, parentId: NodeId, index?: number): DispatchResult;
  removeNode(nodeId: NodeId): DispatchResult;
  moveNode(nodeId: NodeId, parentId: NodeId, index?: number): DispatchResult;
  updateLayout(nodeId: NodeId, layout: Record<string, unknown>): DispatchResult;
  rotateNode(nodeId: NodeId, rotation: number): DispatchResult;
  updateProps(nodeId: NodeId, props: Record<string, unknown>): DispatchResult;
  updateStyle(nodeId: NodeId, style: Record<string, unknown>): DispatchResult;
  updateBindings(nodeId: NodeId, bindings: Binding[]): DispatchResult;
  updateRuntime(nodeId: NodeId, runtime: Record<string, unknown>): DispatchResult;
  batch(actions: RuntimeAction[]): DispatchResult;
}

export interface StateAPI {
  setState(nodeId: NodeId, state: string): void;
  clearState(nodeId: NodeId, state: string): void;
  setExclusive(nodeId: NodeId, state: string, group: string): void;
  getActiveStates(nodeId: NodeId): string[];
}

export interface EngineAPI {
  node: NodeAPI;
  scene: SceneAPI;
  selection: SelectionAPI;
  history: HistoryAPI;
  dispatch: DispatchAPI;
  states: StateAPI;
  subscribeToNode(nodeId: NodeId, callback: (node: SceneNode) => void): () => void;
  subscribeToScene(callback: (scene: SceneGraph) => void): () => void;
  subscribeToSelection(callback: (nodeIds: NodeId[]) => void): () => void;
}

type Subscriber<T> = (data: T) => void;

export function createEngineAPI(
  getScene: () => SceneGraph,
  pageId: PageId,
  commandBus: CommandBus,
  getHistory: () => RuntimeHistoryState,
): EngineAPI {
  const subscribers = new Map<string, Set<Subscriber<unknown>>>();

  function notify(key: string, data: unknown) {
    subscribers.get(key)?.forEach((cb) => cb(data));
  }

  const nodeAPI: NodeAPI = {
    get(nodeId) { return getScene().nodes[nodeId]; },
    getParent(nodeId) {
      const node = getScene().nodes[nodeId];
      return node?.parentId ? getScene().nodes[node.parentId] : undefined;
    },
    getChildren(nodeId) {
      const node = getScene().nodes[nodeId];
      return node?.children?.map((id) => getScene().nodes[id]).filter(Boolean) as SceneNode[] ?? [];
    },
    getProps(nodeId) { return getScene().nodes[nodeId]?.props ?? {}; },
    getLayout(nodeId) { return getScene().nodes[nodeId]?.layout as Layout | undefined; },
    getBindings(nodeId) { return getScene().nodes[nodeId]?.bindings ?? []; },
    getStyle(nodeId) { return getScene().nodes[nodeId]?.style ?? {}; },
    isVisible(nodeId) { return getScene().nodes[nodeId]?.visible !== false; },
    isLocked(nodeId) { return getScene().nodes[nodeId]?.locked === true; },
    exists(nodeId) { return nodeId in getScene().nodes; },
  };

  function getAllNodes(): SceneNode[] {
    return Object.values(getScene().nodes);
  }

  const sceneAPI: SceneAPI = {
    getRoot() { return getScene().nodes[getScene().rootId]!; },
    getActivePageId() { return pageId; },
    getSceneVersion() { return getScene().version; },
    getAllNodes,
    findNodes(predicate) { return getAllNodes().filter(predicate); },
    findNodeByType(type) { return getAllNodes().filter((n) => n.type === type); },
  };

  const selectionAPI: SelectionAPI = {
    getSelection() { return getScene().selection?.nodeIds ?? []; },
    isSelected(nodeId) { return getScene().selection?.nodeIds.includes(nodeId) ?? false; },
    select(nodeIds) {
      const unique = [...new Set(nodeIds)];
      commandBus.dispatch({ type: "update-selection", nodeIds: unique });
    },
    addToSelection(nodeIds) {
      const current = getScene().selection?.nodeIds ?? [];
      const unique = [...new Set([...current, ...nodeIds])];
      commandBus.dispatch({ type: "update-selection", nodeIds: unique });
    },
    removeFromSelection(nodeIds) {
      const current = getScene().selection?.nodeIds ?? [];
      const set = new Set(nodeIds);
      commandBus.dispatch({ type: "update-selection", nodeIds: current.filter((id) => !set.has(id)) });
    },
    clearSelection() { commandBus.dispatch({ type: "update-selection", nodeIds: [] }); },
    selectAll() {
      const all = getAllNodes().filter((n) => n.id !== getScene().rootId);
      commandBus.dispatch({ type: "update-selection", nodeIds: all.map((n) => n.id) });
    },
    selectParent(nodeId) {
      const parent = nodeAPI.getParent(nodeId);
      if (parent) commandBus.dispatch({ type: "update-selection", nodeIds: [parent.id] });
    },
    selectChildren(nodeId) {
      const children = nodeAPI.getChildren(nodeId);
      commandBus.dispatch({ type: "update-selection", nodeIds: children.map((c) => c.id) });
    },
  };

  const historyAPI: HistoryAPI = {
    canUndo() { return getHistory().undoStack.length > 0; },
    canRedo() { return getHistory().redoStack.length > 0; },
    undo() {
      const result = undoRuntimeAction(getHistory());
      if (result) commandBus.dispatch(result.inverseAction as RuntimeAction);
    },
    redo() {
      const result = redoRuntimeAction(getHistory());
      if (result) commandBus.dispatch(result.action as RuntimeAction);
    },
    getUndoStackSize() { return getHistory().undoStack.length; },
    getRedoStackSize() { return getHistory().redoStack.length; },
  };

  const dispatchAPI: DispatchAPI = {
    createNode(node, parentId, index) {
      return commandBus.dispatch({ type: "create-node", node, parentId, index }) as DispatchResult;
    },
    removeNode(nodeId) {
      return commandBus.dispatch({ type: "remove-node", nodeId }) as DispatchResult;
    },
    moveNode(nodeId, parentId, index) {
      return commandBus.dispatch({ type: "move-node", nodeId, parentId, index }) as DispatchResult;
    },
    updateLayout(nodeId, layout) {
      return commandBus.dispatch({ type: "update-layout", nodeId, layout }) as DispatchResult;
    },
    rotateNode(nodeId, rotation) {
      return commandBus.dispatch({ type: "rotate-node", nodeId, rotation }) as DispatchResult;
    },
    updateProps(nodeId, props) {
      return commandBus.dispatch({ type: "update-props", nodeId, props }) as DispatchResult;
    },
    updateStyle(nodeId, style) {
      return commandBus.dispatch({ type: "update-style", nodeId, style }) as DispatchResult;
    },
    updateBindings(nodeId, bindings) {
      return commandBus.dispatch({ type: "update-bindings", nodeId, bindings }) as DispatchResult;
    },
    updateRuntime(nodeId, runtime) {
      return commandBus.dispatch({ type: "update-runtime", nodeId, runtime }) as DispatchResult;
    },
    batch(actions) {
      return commandBus.dispatch({ type: "batch-actions", actions }) as DispatchResult;
    },
  };

  const stateAPI: StateAPI = {
    setState(nodeId, state) {
      const node = getScene().nodes[nodeId];
      if (!node) return;
      const active = node.activeStates ? [...node.activeStates] : [];
      const idx = active.indexOf(state);
      if (idx >= 0) active.splice(idx, 1);
      active.push(state);
      commandBus.dispatch({ type: "update-runtime", nodeId, runtime: { activeStates: active } });
    },
    clearState(nodeId, state) {
      const node = getScene().nodes[nodeId];
      if (!node) return;
      const active = (node.activeStates ?? []).filter((s) => s !== state);
      commandBus.dispatch({ type: "update-runtime", nodeId, runtime: { activeStates: active } });
    },
    setExclusive(nodeId, state, group) {
      const all = getAllNodes();
      for (const n of all) {
        if (n.id !== nodeId && n.activeStates?.includes(state)) {
          stateAPI.clearState(n.id, state);
        }
      }
      stateAPI.setState(nodeId, state);
    },
    getActiveStates(nodeId) {
      return getScene().nodes[nodeId]?.activeStates ?? [];
    },
  };

  return {
    node: nodeAPI,
    scene: sceneAPI,
    selection: selectionAPI,
    history: historyAPI,
    dispatch: dispatchAPI,
    states: stateAPI,
    subscribeToNode(nodeId, callback) {
      const key = `node:${nodeId}`;
      if (!subscribers.has(key)) subscribers.set(key, new Set());
      subscribers.get(key)!.add(callback as Subscriber<unknown>);
      return () => subscribers.get(key)?.delete(callback as Subscriber<unknown>);
    },
    subscribeToScene(callback) {
      const key = "scene";
      if (!subscribers.has(key)) subscribers.set(key, new Set());
      subscribers.get(key)!.add(callback as Subscriber<unknown>);
      return () => subscribers.get(key)?.delete(callback as Subscriber<unknown>);
    },
    subscribeToSelection(callback) {
      const key = "selection";
      if (!subscribers.has(key)) subscribers.set(key, new Set());
      subscribers.get(key)!.add(callback as Subscriber<unknown>);
      return () => subscribers.get(key)?.delete(callback as Subscriber<unknown>);
    },
  };
}
