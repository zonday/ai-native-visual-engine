import type { RuntimeAction } from "./runtime/actions.js";
import type { CommandBus, DispatchResult } from "./runtime/command-bus.js";
import type { RuntimeHistoryState } from "./runtime/history.js";
import { redoRuntimeAction, undoRuntimeAction } from "./runtime/history.js";
import type {
  Binding,
  Layout,
  NodeId,
  PageId,
  SceneGraph,
  SceneNode,
} from "./types.js";

function getNodeId(action: RuntimeAction): string {
  if ("nodeId" in action && typeof action.nodeId === "string") {
    return action.nodeId;
  }
  return "";
}

function getNodeRuntime(node: SceneNode): Record<string, unknown> {
  const rt = node.runtime;
  if (rt && typeof rt === "object") {
    return rt as Record<string, unknown>;
  }
  return {};
}

function getRuntimeActiveStates(node: SceneNode): string[] {
  const rt = getNodeRuntime(node);
  const states = rt.activeStates;
  return Array.isArray(states) ? (states as string[]) : [];
}

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
  updateRuntime(
    nodeId: NodeId,
    runtime: Record<string, unknown>,
  ): DispatchResult;
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
  subscribeToNode(
    nodeId: NodeId,
    callback: (node: SceneNode) => void,
  ): () => void;
  subscribeToScene(callback: (scene: SceneGraph) => void): () => void;
  subscribeToSelection(callback: (nodeIds: NodeId[]) => void): () => void;
}

type Subscriber<T> = (data: T) => void;

function getAllNodes(scene: SceneGraph): SceneNode[] {
  return Object.values(scene.nodes);
}

export function createEngineAPI(
  getScene: () => SceneGraph,
  pageId: PageId,
  commandBus: CommandBus,
  getHistory: () => RuntimeHistoryState,
): EngineAPI {
  const subscribers = new Map<string, Set<Subscriber<unknown>>>();
  const notifyTimers = new Map<string, ReturnType<typeof setTimeout>>();

  function notify(key: string, data: unknown) {
    const existing = notifyTimers.get(key);
    if (existing) clearTimeout(existing);
    notifyTimers.set(
      key,
      setTimeout(() => {
        subscribers.get(key)?.forEach((cb) => {
          cb(data);
        });
        notifyTimers.delete(key);
      }, 0),
    );
  }

  function dispatchAndNotify(action: RuntimeAction): DispatchResult {
    const scene = getScene();

    if (
      action.type === "create-node" &&
      action.parentId &&
      !scene.nodes[action.parentId]
    ) {
      return {
        ok: false,
        scene,
        error: {
          code: "scene.invalid-parent",
          message: `Parent "${action.parentId}" not found`,
          actionType: "create-node",
          nodeId: action.parentId,
        },
      };
    }
    if (
      (action.type === "remove-node" || action.type === "move-node") &&
      "nodeId" in action
    ) {
      const nodeId = getNodeId(action);
      const node = scene.nodes[nodeId];
      if (!node) {
        return {
          ok: false,
          scene,
          error: {
            code: "scene.node-not-found",
            message: `Node "${action.nodeId}" not found`,
            actionType: action.type,
            nodeId: getNodeId(action),
          },
        };
      }
      if (action.type === "remove-node" && node.locked) {
        return {
          ok: false,
          scene,
          error: {
            code: "scene.locked",
            message: `Node "${action.nodeId}" is locked`,
            actionType: "remove-node",
            nodeId: getNodeId(action),
          },
        };
      }
    }
    if (
      action.type === "update-layout" ||
      action.type === "rotate-node" ||
      action.type === "update-props" ||
      action.type === "update-style" ||
      action.type === "update-bindings" ||
      action.type === "update-runtime"
    ) {
      if ("nodeId" in action && !scene.nodes[getNodeId(action)]) {
        return {
          ok: false,
          scene,
          error: {
            code: "scene.node-not-found",
            message: `Node "${action.nodeId}" not found`,
            actionType: action.type,
            nodeId: getNodeId(action),
          },
        };
      }
    }

    const result = commandBus.dispatch(action);
    if (result.ok) {
      notify("scene", getScene());
      notify("selection", getScene().selection?.nodeIds ?? []);
    }
    return result;
  }

  const nodeAPI: NodeAPI = {
    get(nodeId) {
      return getScene().nodes[nodeId];
    },
    getParent(nodeId) {
      const node = getScene().nodes[nodeId];
      return node?.parentId ? getScene().nodes[node.parentId] : undefined;
    },
    getChildren(nodeId) {
      const node = getScene().nodes[nodeId];
      return (
        (node?.children
          ?.map((id) => getScene().nodes[id])
          .filter(Boolean) as SceneNode[]) ?? []
      );
    },
    getProps(nodeId) {
      return getScene().nodes[nodeId]?.props ?? {};
    },
    getLayout(nodeId) {
      return getScene().nodes[nodeId]?.layout as Layout | undefined;
    },
    getBindings(nodeId) {
      return getScene().nodes[nodeId]?.bindings ?? [];
    },
    getStyle(nodeId) {
      return getScene().nodes[nodeId]?.style ?? {};
    },
    isVisible(nodeId) {
      return getScene().nodes[nodeId]?.visible !== false;
    },
    isLocked(nodeId) {
      return getScene().nodes[nodeId]?.locked === true;
    },
    exists(nodeId) {
      return nodeId in getScene().nodes;
    },
  };

  const sceneAPI: SceneAPI = {
    getRoot() {
      const root = getScene().nodes[getScene().rootId];
      return root ?? ({} as SceneNode);
    },
    getActivePageId() {
      return pageId;
    },
    getSceneVersion() {
      return getScene().version;
    },
    getAllNodes() {
      return getAllNodes(getScene());
    },
    findNodes(predicate) {
      return getAllNodes(getScene()).filter(predicate);
    },
    findNodeByType(type) {
      return getAllNodes(getScene()).filter((n) => n.type === type);
    },
  };

  const selectionAPI: SelectionAPI = {
    getSelection() {
      return getScene().selection?.nodeIds ?? [];
    },
    isSelected(nodeId) {
      return getScene().selection?.nodeIds.includes(nodeId) === true;
    },
    select(nodeIds) {
      const unique = [...new Set(nodeIds)];
      dispatchAndNotify({ type: "update-selection", nodeIds: unique });
    },
    addToSelection(nodeIds) {
      const current = getScene().selection?.nodeIds ?? [];
      const unique = [...new Set([...current, ...nodeIds])];
      dispatchAndNotify({ type: "update-selection", nodeIds: unique });
    },
    removeFromSelection(nodeIds) {
      const current = getScene().selection?.nodeIds ?? [];
      const set = new Set(nodeIds);
      dispatchAndNotify({
        type: "update-selection",
        nodeIds: current.filter((id) => !set.has(id)),
      });
    },
    clearSelection() {
      dispatchAndNotify({ type: "update-selection", nodeIds: [] });
    },
    selectAll() {
      const all = getAllNodes(getScene()).filter(
        (n) => n.id !== getScene().rootId,
      );
      dispatchAndNotify({
        type: "update-selection",
        nodeIds: all.map((n) => n.id),
      });
    },
    selectParent(nodeId) {
      const parent = nodeAPI.getParent(nodeId);
      if (parent)
        dispatchAndNotify({ type: "update-selection", nodeIds: [parent.id] });
    },
    selectChildren(nodeId) {
      const children = nodeAPI.getChildren(nodeId);
      dispatchAndNotify({
        type: "update-selection",
        nodeIds: children.map((c) => c.id),
      });
    },
  };

  const historyAPI: HistoryAPI = {
    canUndo() {
      return getHistory().undoStack.length > 0;
    },
    canRedo() {
      return getHistory().redoStack.length > 0;
    },
    undo() {
      const result = undoRuntimeAction(getHistory());
      if (result) dispatchAndNotify(result.inverseAction);
    },
    redo() {
      const result = redoRuntimeAction(getHistory());
      if (result) dispatchAndNotify(result.action);
    },
    getUndoStackSize() {
      return getHistory().undoStack.length;
    },
    getRedoStackSize() {
      return getHistory().redoStack.length;
    },
  };

  const dispatchAPI: DispatchAPI = {
    createNode(node, parentId, index) {
      return dispatchAndNotify({ type: "create-node", node, parentId, index });
    },
    removeNode(nodeId) {
      return dispatchAndNotify({ type: "remove-node", nodeId });
    },
    moveNode(nodeId, parentId, index) {
      return dispatchAndNotify({ type: "move-node", nodeId, parentId, index });
    },
    updateLayout(nodeId, layout) {
      return dispatchAndNotify({ type: "update-layout", nodeId, layout });
    },
    rotateNode(nodeId, rotation) {
      return dispatchAndNotify({ type: "rotate-node", nodeId, rotation });
    },
    updateProps(nodeId, props) {
      return dispatchAndNotify({ type: "update-props", nodeId, props });
    },
    updateStyle(nodeId, style) {
      return dispatchAndNotify({ type: "update-style", nodeId, style });
    },
    updateBindings(nodeId, bindings) {
      return dispatchAndNotify({ type: "update-bindings", nodeId, bindings });
    },
    updateRuntime(nodeId, runtime) {
      return dispatchAndNotify({ type: "update-runtime", nodeId, runtime });
    },
    batch(actions) {
      return dispatchAndNotify({ type: "batch-actions", actions });
    },
  };

  const stateAPI: StateAPI = {
    setState(nodeId, state) {
      const node = getScene().nodes[nodeId];
      if (!node) return;
      const active = getRuntimeActiveStates(node);
      const idx = active.indexOf(state);
      if (idx >= 0) active.splice(idx, 1);
      active.push(state);
      dispatchAndNotify({
        type: "update-runtime",
        nodeId,
        runtime: { activeStates: active },
      });
    },
    clearState(nodeId, state) {
      const node = getScene().nodes[nodeId];
      if (!node) return;
      const active = getRuntimeActiveStates(node).filter((s) => s !== state);
      dispatchAndNotify({
        type: "update-runtime",
        nodeId,
        runtime: { activeStates: active },
      });
    },
    setExclusive(nodeId, state, _group) {
      const all = getAllNodes(getScene());
      const actions: RuntimeAction[] = [];
      for (const n of all) {
        const existing = getRuntimeActiveStates(n);
        if (n.id !== nodeId && existing?.includes(state)) {
          actions.push({
            type: "update-runtime",
            nodeId: n.id,
            runtime: { activeStates: existing.filter((s) => s !== state) },
          });
        }
      }
      const thisNode = getScene().nodes[nodeId];
      if (thisNode) {
        const active = getRuntimeActiveStates(thisNode);
        const idx = active.indexOf(state);
        if (idx >= 0) active.splice(idx, 1);
        active.push(state);
        actions.push({
          type: "update-runtime",
          nodeId,
          runtime: { activeStates: active },
        });
      }
      if (actions.length > 0) {
        dispatchAndNotify({ type: "batch-actions", actions });
      }
    },
    getActiveStates(nodeId) {
      const node = getScene().nodes[nodeId];
      if (!node) return [];
      return getRuntimeActiveStates(node);
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
      subscribers.get(key)?.add(callback as Subscriber<unknown>);
      return () =>
        subscribers.get(key)?.delete(callback as Subscriber<unknown>);
    },
    subscribeToScene(callback) {
      const key = "scene";
      if (!subscribers.has(key)) subscribers.set(key, new Set());
      subscribers.get(key)?.add(callback as Subscriber<unknown>);
      return () =>
        subscribers.get(key)?.delete(callback as Subscriber<unknown>);
    },
    subscribeToSelection(callback) {
      const key = "selection";
      if (!subscribers.has(key)) subscribers.set(key, new Set());
      subscribers.get(key)?.add(callback as Subscriber<unknown>);
      return () =>
        subscribers.get(key)?.delete(callback as Subscriber<unknown>);
    },
  };
}
