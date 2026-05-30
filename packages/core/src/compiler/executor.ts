import type { DocumentDispatchResult } from "../document/document-command-bus.js";
import type { DocumentAction } from "../document/register-handlers.js";
import type { DispatchResult } from "../engine/command-bus.js";
import type { HistoryState } from "../engine/history.js";
import { pushUndoTransaction } from "../engine/history.js";
import type { TransactionFlag } from "../engine/transaction-flag.js";
import type { TransactionManager } from "../engine/transaction-manager.js";
import type { RuntimeContext } from "../runtime/handler-registry.js";
import type { RuntimeAction } from "../runtime/register-handlers.js";
import type { SceneGraph } from "../types.js";

type RuntimeHistoryState = HistoryState<RuntimeAction>;
const pushRuntimeUndoTransaction = pushUndoTransaction<RuntimeAction>;

import type { ExecutionPlan, SemanticDiagnostic } from "./types.js";

export interface ExecutePlanDeps {
  runtimeTm: TransactionManager<SceneGraph, RuntimeAction, RuntimeContext>;
  runtimeDispatch: (action: RuntimeAction) => DispatchResult<SceneGraph>;
  runtimeContext: RuntimeContext;
  transactionFlag: TransactionFlag;
  getRuntimeHistory: () => RuntimeHistoryState;
  setRuntimeHistory: (state: RuntimeHistoryState) => void;
  documentDispatch?: (action: DocumentAction) => DocumentDispatchResult;
}

export interface ExecutePlanResult {
  ok: boolean;
  scene: SceneGraph;
  diagnostics: SemanticDiagnostic[];
}

export function executePlan(
  plan: ExecutionPlan,
  scene: SceneGraph,
  deps: ExecutePlanDeps,
): ExecutePlanResult {
  const diagnostics: SemanticDiagnostic[] = [];

  // 1. Execute document actions (direct dispatch, no transaction)
  if (deps.documentDispatch) {
    for (const action of plan.documentActions) {
      const result = deps.documentDispatch(action);
      if (!result.ok) {
        diagnostics.push({
          code: "executor.document-action-failed",
          message:
            result.error?.message ?? `Document action ${action.type} failed`,
          severity: "error",
        });
        return { ok: false, scene, diagnostics };
      }
    }
  }

  if (plan.runtimeActions.length === 0) {
    return { ok: true, scene, diagnostics };
  }

  // 2. Execute runtime actions within a transaction
  deps.transactionFlag.setActive(true);
  const tx = deps.runtimeTm.begin("ai", scene, deps.runtimeContext);

  for (const action of plan.runtimeActions) {
    const result = deps.runtimeTm.applyAction(tx, action);
    if (!result.ok) {
      deps.transactionFlag.setActive(false);
      deps.runtimeTm.rollback(tx);
      diagnostics.push({
        code: "executor.runtime-action-failed",
        message:
          result.error?.message ?? `Runtime action ${action.type} failed`,
        severity: "error",
      });
      return { ok: false, scene, diagnostics };
    }
  }

  const commitResult = deps.runtimeTm.commit(tx);
  deps.transactionFlag.setActive(false);

  if (!commitResult.ok) {
    diagnostics.push({
      code: "executor.transaction-commit-failed",
      message: commitResult.error?.message ?? "Transaction commit failed",
      severity: "error",
    });
    return { ok: false, scene, diagnostics };
  }

  // 3. Push transaction-level history entry
  const inverses = [...tx.appliedInverses].reverse();
  if (inverses.length > 0) {
    const currentHistory = deps.getRuntimeHistory();
    const actorId = deps.runtimeContext.actorId;
    const newHistory = pushRuntimeUndoTransaction(
      currentHistory,
      plan.runtimeActions,
      inverses,
      deps.runtimeContext.now(),
      actorId,
    );
    deps.setRuntimeHistory(newHistory);
  }

  return { ok: true, scene: commitResult.state, diagnostics };
}
