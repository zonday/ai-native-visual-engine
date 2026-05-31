import { type ComputedStore, createComputedStore } from "./computed-store.js";
import type { ActionRegistry } from "./engine/action-registry.js";
import type { HistoryState } from "./engine/history.js";
import { redoAction, undoAction } from "./engine/history.js";
import type { ActiveTransaction } from "./engine/transaction-manager.js";
import { TransactionManager } from "./engine/transaction-manager.js";
import type { TransactionSource } from "./engine/transaction-types.js";
import { EventBus } from "./event-bus.js";
import type { RuntimeContext } from "./runtime/handler-registry.js";
import type { RuntimeAction } from "./runtime/register-handlers.js";
import type { CommandBus } from "./runtime/runtime-command-bus.js";
import type { SceneStore } from "./scene-store.js";
import { createSceneStore } from "./scene-store.js";
import type { NodeId, SceneGraph } from "./types.js";

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

// ── Helpers ──

function collectAffectedNodeIds(action: RuntimeAction): NodeId[] {
  if ("nodeId" in action && typeof action.nodeId === "string") {
    return [action.nodeId];
  }
  if (action.type === "create-node") {
    return [action.node.id];
  }
  if (action.type === "batch-actions") {
    const ids: NodeId[] = [];
    for (const child of action.actions) {
      ids.push(...collectAffectedNodeIds(child));
    }
    return ids;
  }
  return [];
}

// ── Factory ──

export function createEngine(
  getScene: () => SceneGraph,
  commandBus: CommandBus,
  getHistory: () => HistoryState<RuntimeAction>,
  setHistory?: (state: HistoryState<RuntimeAction>) => void,
  registry?: ActionRegistry<RuntimeAction, SceneGraph, RuntimeContext>,
): Engine {
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
    const result = commandBus.dispatch(action);
    if (result.ok) {
      selectors.setScene(getScene(), collectAffectedNodeIds(action));
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
      const result = transactionManager.applyAction(active, action);
      if (result.ok) {
        selectors.setScene(getScene(), collectAffectedNodeIds(action));
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
        selectors.setScene(getScene(), []);
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
