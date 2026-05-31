import { type ComputedStore, createComputedStore } from "../computed-store.js";
import { EventBus } from "../event-bus.js";
import type { RuntimeContext } from "../runtime/handler-registry.js";
import type { RuntimeAction } from "../runtime/register-handlers.js";
import type { CommandBus } from "../runtime/runtime-command-bus.js";
import type { SceneStore } from "../scene-store.js";
import { createSceneStore } from "../scene-store.js";
import type { NodeId, SceneGraph } from "../types.js";
import type { ActionRegistry } from "./action-registry.js";
import type { HistoryState } from "./history.js";
import { redoAction, undoAction } from "./history.js";
import { initImmerPatches } from "./immer-patch-router.js";
import type { ScenePatch } from "./patch-types.js";
import type { ActiveTransaction, TransactionSource } from "./transaction.js";
import { TransactionManager } from "./transaction.js";

export type { ComputedStore, SceneStore };

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

// ── Engine ──

export interface Engine {
  command(action: RuntimeAction): CommandResult;
  selector: SceneStore;
  computed: ComputedStore;
  events: EventBus;
  history: HistoryService;
  transaction: TransactionService;
}

function collectScenePatches(
  sceneBefore: SceneGraph,
  action: RuntimeAction,
): ScenePatch[] | undefined {
  switch (action.type) {
    case "create-node":
      return [
        { type: "add-node", nodeId: action.node.id },
        { type: "set-prop", nodeId: action.parentId, field: "children" },
      ];
    case "remove-node": {
      const oldParentId = sceneBefore.nodes[action.nodeId]?.parentId;
      return [
        { type: "remove-node", nodeId: action.nodeId },
        ...(oldParentId
          ? ([
              {
                type: "set-prop",
                nodeId: oldParentId,
                field: "children",
              },
            ] satisfies ScenePatch[])
          : []),
      ];
    }
    case "move-node": {
      const oldParentId = sceneBefore.nodes[action.nodeId]?.parentId;
      return [
        {
          type: "reparent",
          nodeId: action.nodeId,
          oldParent: oldParentId,
          newParent: action.parentId,
        },
      ];
    }
    case "update-layout":
    case "rotate-node":
      return [{ type: "set-prop", nodeId: action.nodeId, field: "layout" }];
    case "update-props":
      return [{ type: "set-prop", nodeId: action.nodeId, field: "props" }];
    case "update-style":
      return [{ type: "set-prop", nodeId: action.nodeId, field: "style" }];
    case "update-bindings":
      return [{ type: "set-prop", nodeId: action.nodeId, field: "bindings" }];
    case "update-selection":
    case "update-runtime":
      return undefined;
    case "batch-actions":
      return undefined;
    default:
      return undefined;
  }
}

// ── Factory ──

export function createEngine(
  getScene: () => SceneGraph,
  commandBus: CommandBus,
  getHistory: () => HistoryState<RuntimeAction>,
  setHistory?: (state: HistoryState<RuntimeAction>) => void,
  registry?: ActionRegistry<RuntimeAction, SceneGraph, RuntimeContext>,
): Engine {
  initImmerPatches();

  // ── TransactionManager: uses commandBus for dispatch so state stays in sync ──

  const transactionManager = registry
    ? new TransactionManager<SceneGraph, RuntimeAction, RuntimeContext>({
        registry,
        dispatch: (action) => {
          const result = commandBus.dispatch(action);
          return {
            ok: result.ok,
            state: result.scene,
            error: result.error,
          };
        },
      })
    : undefined;

  // ── EventBus: single notification hub ──

  const events = new EventBus();

  function notifyScene(scene: SceneGraph) {
    events.emit("scene", scene);
  }

  function notifySelection(nodeIds: NodeId[]) {
    events.emit("selection", nodeIds);
  }

  // ── SceneStore: memoized reactive query layer ──

  const selectors = createSceneStore(getScene());
  const computed = createComputedStore(selectors);

  // ── Single dispatch+notify pathway ──

  function doDispatch(action: RuntimeAction): CommandResult {
    const sceneBefore = selectors.getScene();
    const result = commandBus.dispatch(action);
    if (result.ok) {
      selectors.setScene(getScene(), collectScenePatches(sceneBefore, action));
      notifyScene(getScene());
      notifySelection(getScene().selection?.nodeIds ?? []);
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

  // ── HistoryService ──

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

  // ── TransactionService ──

  const transaction: TransactionService = {
    begin(source, metadata) {
      if (!transactionManager) {
        throw new Error("TransactionManager not configured");
      }
      const scene = selectors.getScene();
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
      const sceneBefore = selectors.getScene();
      const result = transactionManager.applyAction(active, action);
      if (result.ok) {
        selectors.setScene(
          getScene(),
          collectScenePatches(sceneBefore, action),
        );
        notifyScene(getScene());
        notifySelection(getScene().selection?.nodeIds ?? []);
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
        notifyScene(getScene());
        notifySelection(getScene().selection?.nodeIds ?? []);
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
      selectors.setScene(preState);
      notifyScene(preState);
      notifySelection(preState.selection?.nodeIds ?? []);
    },
    getActive() {
      return transactionManager?.getActiveTransaction();
    },
  };

  return {
    command: doDispatch,
    selector: selectors,
    computed,
    events,
    history,
    transaction,
  };
}
