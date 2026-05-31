import {
  type ComputedStateEngine,
  createComputedStateEngine,
} from "./computed/computed-state-engine.js";
import type { ActionRegistry } from "./engine/action-registry.js";
import type { HistoryState } from "./engine/history.js";
import { redoAction, undoAction } from "./engine/history.js";
import type { ActiveTransaction } from "./engine/transaction-manager.js";
import { TransactionManager } from "./engine/transaction-manager.js";
import type { TransactionSource } from "./engine/transaction-types.js";
import type { RuntimeContext } from "./runtime/handler-registry.js";
import type { RuntimeAction } from "./runtime/register-handlers.js";
import type { CommandBus } from "./runtime/runtime-command-bus.js";
import {
  createSelectorRegistry,
  type SelectorRegistry,
} from "./selector/selector-registry.js";
import type {
  Binding,
  Layout,
  NodeId,
  PageId,
  SceneGraph,
  SceneNode,
} from "./types.js";

export type { ComputedStateEngine, SelectorRegistry };

// ── Unified Result Type ──

export interface CommandResult {
  ok: boolean;
  error?: {
    code: string;
    message: string;
    actionType?: string;
    nodeId?: string;
  };
}

// ── Query Service ──

export interface NodeQuery {
  get(nodeId: NodeId): Readonly<SceneNode> | undefined;
  getParent(nodeId: NodeId): Readonly<SceneNode> | undefined;
  getChildren(nodeId: NodeId): ReadonlyArray<Readonly<SceneNode>>;
  getProps(nodeId: NodeId): Readonly<Record<string, unknown>>;
  getLayout(nodeId: NodeId): Readonly<Layout> | undefined;
  getBindings(nodeId: NodeId): readonly Binding[];
  getStyle(nodeId: NodeId): Readonly<Record<string, unknown>>;
  isVisible(nodeId: NodeId): boolean;
  isLocked(nodeId: NodeId): boolean;
  exists(nodeId: NodeId): boolean;
}

export interface SceneQuery {
  getRoot(): Readonly<SceneNode>;
  getActivePageId(): PageId;
  getSceneVersion(): number;
  getAllNodes(): ReadonlyArray<Readonly<SceneNode>>;
  findNodes(
    predicate: (node: Readonly<SceneNode>) => boolean,
  ): ReadonlyArray<Readonly<SceneNode>>;
  findNodeByType(type: string): ReadonlyArray<Readonly<SceneNode>>;
}

export interface SelectionQuery {
  getSelection(): readonly NodeId[];
  isSelected(nodeId: NodeId): boolean;
}

export interface QueryService {
  node: NodeQuery;
  scene: SceneQuery;
  selection: SelectionQuery;
}

// ── Command Service ──

export interface CommandService {
  dispatch(action: RuntimeAction): CommandResult;
}

// ── History Service ──

export interface HistoryService {
  canUndo(): boolean;
  canRedo(): boolean;
  undo(): CommandResult;
  redo(): CommandResult;
  getUndoStackSize(): number;
  getRedoStackSize(): number;
}

// ── Transaction Service ──

type RuntimeActiveTransaction = ActiveTransaction<
  SceneGraph,
  RuntimeAction,
  RuntimeContext
>;

export interface TransactionService {
  begin(
    source: TransactionSource,
    metadata?: Record<string, unknown>,
  ): RuntimeActiveTransaction;
  applyAction(
    active: RuntimeActiveTransaction,
    action: RuntimeAction,
  ): CommandResult;
  commit(active: RuntimeActiveTransaction): CommandResult;
  rollback(active: RuntimeActiveTransaction): void;
  getActive(): RuntimeActiveTransaction | undefined;
}

// ── State Service ──

export interface StateService {
  setState(nodeId: NodeId, state: string): CommandResult;
  clearState(nodeId: NodeId, state: string): CommandResult;
  setExclusive(nodeId: NodeId, state: string, group: string): CommandResult;
  getActiveStates(nodeId: NodeId): readonly string[];
}

// ── Event Bus ──

export interface EventBus {
  subscribeToScene(callback: (scene: SceneGraph) => void): () => void;
  subscribeToSelection(callback: (nodeIds: NodeId[]) => void): () => void;
}

// ── SelectorAPI (stub — see selector-system.md) ──

export interface SelectorAPI {
  getNode(nodeId: NodeId): SceneNode | undefined;
  getChildren(nodeId: NodeId): SceneNode[];
  getParent(nodeId: NodeId): SceneNode | undefined;
  getRoot(): SceneNode;
  getAncestors(nodeId: NodeId): SceneNode[];
  getDescendants(nodeId: NodeId): SceneNode[];
  getVisibleNodes(): SceneNode[];
}

// ── ComputedStateAPI (stub — see computed-state-engine.md) ──

export interface ComputedStateAPI {
  getWorldTransform(nodeId: NodeId): { x: number; y: number; rotation: number };
  getComputedBounds(nodeId: NodeId): {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  getVisibleBounds(nodeId: NodeId): {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
  getCenter(nodeId: NodeId): { x: number; y: number };
}

// ── Engine Facade ──

export interface EngineFacade {
  query: QueryService;
  command: CommandService;
  history: HistoryService;
  transaction: TransactionService;
  states: StateService;
  events: EventBus;
  selector: SelectorRegistry;
  computed: ComputedStateEngine;
}

// ── Helpers ──

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
  return Array.isArray(states) ? [...(states as string[])] : [];
}

function getAllNodes(scene: SceneGraph): SceneNode[] {
  return Object.values(scene.nodes);
}

// ── Factory ──

export function createEngineFacade(
  getScene: () => SceneGraph,
  getPageId: () => PageId,
  commandBus: CommandBus,
  getHistory: () => HistoryState<RuntimeAction>,
  setHistory?: (state: HistoryState<RuntimeAction>) => void,
  registry?: ActionRegistry<RuntimeAction, SceneGraph, RuntimeContext>,
): EngineFacade {
  // ── TransactionManager: uses commandBus for dispatch so state stays in sync ──

  const transactionManager = registry
    ? new TransactionManager<SceneGraph, RuntimeAction, RuntimeContext>({
        registry,
        dispatch: (action) => {
          const result = commandBus.dispatch(action);
          return {
            ok: result.ok,
            state: result.scene,
            error: result.error
              ? {
                  code: result.error.code,
                  message: result.error.message,
                  actionType: result.error.actionType,
                }
              : undefined,
          };
        },
      })
    : undefined;
  // ── EventBus: single notification hub ──

  type Subscriber = (data: unknown) => void;
  const subscribers = new Map<string, Set<Subscriber>>();
  const notifyTimers = new Map<string, ReturnType<typeof setTimeout>>();

  function scheduleNotification(key: string, data: unknown) {
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

  const events: EventBus = {
    subscribeToScene(callback) {
      const key = "scene";
      if (!subscribers.has(key)) subscribers.set(key, new Set());
      subscribers.get(key)?.add(callback as Subscriber);
      return () => subscribers.get(key)?.delete(callback as Subscriber);
    },
    subscribeToSelection(callback) {
      const key = "selection";
      if (!subscribers.has(key)) subscribers.set(key, new Set());
      subscribers.get(key)?.add(callback as Subscriber);
      return () => subscribers.get(key)?.delete(callback as Subscriber);
    },
  };

  // ── SelectorRegistry: memoized reactive query layer ──

  const selectors = createSelectorRegistry(getScene());
  const computed = createComputedStateEngine(selectors);

  // ── Single dispatch+notify pathway ──
  // No validation — handlers and middleware own that responsibility.

  function doDispatch(action: RuntimeAction): CommandResult {
    const result = commandBus.dispatch(action);
    if (result.ok) {
      selectors.setScene(getScene());
      scheduleNotification("scene", getScene());
      scheduleNotification("selection", getScene().selection?.nodeIds ?? []);
    }
    return {
      ok: result.ok,
      error: result.error
        ? {
            code: result.error.code,
            message: result.error.message,
            actionType: result.error.actionType,
            nodeId: result.error.nodeId,
          }
        : undefined,
    };
  }

  // ── QueryService ──

  const nodeQuery: NodeQuery = {
    get(nodeId) {
      return getScene().nodes[nodeId] as Readonly<SceneNode> | undefined;
    },
    getParent(nodeId) {
      const node = getScene().nodes[nodeId];
      return node?.parentId
        ? (getScene().nodes[node.parentId] as Readonly<SceneNode> | undefined)
        : undefined;
    },
    getChildren(nodeId) {
      const node = getScene().nodes[nodeId];
      return (
        (node?.children
          ?.map((id) => getScene().nodes[id])
          .filter(Boolean) as ReadonlyArray<Readonly<SceneNode>>) ?? []
      );
    },
    getProps(nodeId) {
      return (getScene().nodes[nodeId]?.props ?? {}) as Readonly<
        Record<string, unknown>
      >;
    },
    getLayout(nodeId) {
      return getScene().nodes[nodeId]?.layout as Readonly<Layout> | undefined;
    },
    getBindings(nodeId) {
      return (getScene().nodes[nodeId]?.bindings ?? []) as readonly Binding[];
    },
    getStyle(nodeId) {
      return (getScene().nodes[nodeId]?.style ?? {}) as Readonly<
        Record<string, unknown>
      >;
    },
    isVisible(nodeId) {
      const node = getScene().nodes[nodeId];
      return node !== undefined && node.visible !== false;
    },
    isLocked(nodeId) {
      return getScene().nodes[nodeId]?.locked === true;
    },
    exists(nodeId) {
      return nodeId in getScene().nodes;
    },
  };

  const sceneQuery: SceneQuery = {
    getRoot() {
      const root = getScene().nodes[getScene().rootId];
      if (!root) throw new Error(`Root node "${getScene().rootId}" not found`);
      return root as Readonly<SceneNode>;
    },
    getActivePageId() {
      return getPageId();
    },
    getSceneVersion() {
      return getScene().version;
    },
    getAllNodes() {
      return getAllNodes(getScene()) as ReadonlyArray<Readonly<SceneNode>>;
    },
    findNodes(predicate) {
      return getAllNodes(getScene()).filter(predicate) as ReadonlyArray<
        Readonly<SceneNode>
      >;
    },
    findNodeByType(type) {
      return getAllNodes(getScene()).filter(
        (n) => n.type === type,
      ) as ReadonlyArray<Readonly<SceneNode>>;
    },
  };

  const selectionQuery: SelectionQuery = {
    getSelection() {
      return (getScene().selection?.nodeIds ?? []) as readonly NodeId[];
    },
    isSelected(nodeId) {
      return getScene().selection?.nodeIds.includes(nodeId) === true;
    },
  };

  const query: QueryService = {
    node: nodeQuery,
    scene: sceneQuery,
    selection: selectionQuery,
  };

  // ── CommandService: pure dispatch, no validation ──

  const command: CommandService = {
    dispatch(action) {
      return doDispatch(action);
    },
  };

  // ── HistoryService ──
  //
  // undo/redo applies setHistory AFTER dispatching through middleware.
  // During dispatch the middleware pushes undo entries (and clears redo),
  // but setHistory overwrites with the correct final state.
  // This avoids both double-push and redo-stack corruption.

  const history: HistoryService = {
    canUndo() {
      return getHistory().undoStack.length > 0;
    },
    canRedo() {
      return getHistory().redoStack.length > 0;
    },
    undo() {
      const histState = getHistory();
      const result = undoAction(histState);
      if (!result) return { ok: false };
      for (const inv of result.inverseActions) {
        const r = doDispatch(inv);
        if (!r.ok) return r;
      }
      setHistory?.(result.state);
      return { ok: true };
    },
    redo() {
      const histState = getHistory();
      const result = redoAction(histState);
      if (!result) return { ok: false };
      for (const act of result.actions) {
        const r = doDispatch(act);
        if (!r.ok) return r;
      }
      setHistory?.(result.state);
      return { ok: true };
    },
    getUndoStackSize() {
      return getHistory().undoStack.length;
    },
    getRedoStackSize() {
      return getHistory().redoStack.length;
    },
  };

  // ── StateService: encapsulated state machine ──

  // O(1) exclusive-group index: groupId → nodeId
  const exclusiveGroups = new Map<string, string>();

  const states: StateService = {
    setState(nodeId, state) {
      const node = getScene().nodes[nodeId];
      if (!node) {
        return {
          ok: false,
          error: {
            code: "scene.node-not-found",
            message: `Node "${nodeId}" not found`,
          },
        };
      }
      const active = getRuntimeActiveStates(node);
      const idx = active.indexOf(state);
      if (idx >= 0) active.splice(idx, 1);
      active.push(state);
      return doDispatch({
        type: "update-runtime",
        nodeId,
        runtime: { activeStates: active },
      });
    },
    clearState(nodeId, state) {
      const node = getScene().nodes[nodeId];
      if (!node) {
        return {
          ok: false,
          error: {
            code: "scene.node-not-found",
            message: `Node "${nodeId}" not found`,
          },
        };
      }
      const active = getRuntimeActiveStates(node).filter((s) => s !== state);
      return doDispatch({
        type: "update-runtime",
        nodeId,
        runtime: { activeStates: active },
      });
    },
    setExclusive(nodeId, state, group) {
      const actions: RuntimeAction[] = [];

      // O(1): clear previous holder of this group
      const currentHolderId = exclusiveGroups.get(group);
      if (currentHolderId && currentHolderId !== nodeId) {
        const holder = getScene().nodes[currentHolderId];
        if (holder) {
          const holderStates = getRuntimeActiveStates(holder).filter(
            (s) => s !== state,
          );
          actions.push({
            type: "update-runtime",
            nodeId: currentHolderId,
            runtime: { activeStates: holderStates },
          });
        }
      }

      // Activate state on target node
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

      // Update index
      exclusiveGroups.set(group, nodeId);

      if (actions.length === 0) return { ok: true };
      return doDispatch({ type: "batch-actions", actions });
    },
    getActiveStates(nodeId) {
      const node = getScene().nodes[nodeId];
      if (!node) return [];
      return getRuntimeActiveStates(node);
    },
  };

  // ── TransactionService ──

  const transaction: TransactionService = {
    begin(source, metadata) {
      if (!transactionManager) {
        throw new Error("TransactionManager not configured");
      }
      const scene = getScene();
      const context: RuntimeContext = {
        now: Date.now,
        actorId: "engine-api",
      };
      return transactionManager.begin(source, scene, context, metadata);
    },
    applyAction(active, action) {
      if (!transactionManager) {
        return {
          ok: false,
          error: {
            code: "transaction.not-configured",
            message: "TransactionManager not configured",
            actionType: action.type,
          },
        };
      }
      const result = transactionManager.applyAction(active, action);
      if (result.ok) {
        selectors.setScene(getScene());
        scheduleNotification("scene", getScene());
        scheduleNotification("selection", getScene().selection?.nodeIds ?? []);
      }
      return {
        ok: result.ok,
        error: result.error
          ? {
              code: result.error.code,
              message: result.error.message,
              actionType: result.error.actionType,
            }
          : undefined,
      };
    },
    commit(active) {
      if (!transactionManager) {
        return {
          ok: false,
          error: {
            code: "transaction.not-configured",
            message: "TransactionManager not configured",
          },
        };
      }
      const result = transactionManager.commit(active);
      if (result.ok) {
        selectors.setScene(getScene());
        scheduleNotification("scene", getScene());
        scheduleNotification("selection", getScene().selection?.nodeIds ?? []);
      }
      return {
        ok: result.ok,
        error: result.error
          ? {
              code: result.error.code,
              message: result.error.message,
            }
          : undefined,
      } satisfies CommandResult;
    },
    rollback(active) {
      if (!transactionManager) {
        return;
      }
      const preState = transactionManager.rollback(active);
      // Sync selectors from the pre-state, not the command bus.
      // The command bus dispatch path (config.dispatch → commandBus.dispatch)
      // applied actions during begin/applyAction, and rollback cannot
      // revert the command bus state — it only returns the pre-state.
      // Consumers must read from selectors, not getScene(), after rollback.
      selectors.setScene(preState);
      scheduleNotification("scene", preState);
      scheduleNotification("selection", preState.selection?.nodeIds ?? []);
    },
    getActive() {
      return transactionManager?.getActiveTransaction();
    },
  };

  return {
    query,
    command,
    history,
    transaction,
    states,
    events,
    selector: selectors,
    computed,
  };
}
