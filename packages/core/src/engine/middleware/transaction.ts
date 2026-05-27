import type { Middleware } from "../command-bus.js";
import type { RuntimeContext } from "../handler.js";
import type { HandlerRegistry } from "../handler-registry.js";
import type { HistoryState } from "../history.js";
import { pushUndoTransaction } from "../history.js";
import type { TransactionFlag } from "../transaction-flag.js";
import type { TransactionManager } from "../transaction-manager.js";
import type { TransactionSource } from "../transaction-types.js";

export interface TransactionMiddlewareConfig<
  TState,
  TAction extends { type: string },
  TContext extends RuntimeContext,
> {
  transactionManager: TransactionManager<TState, TAction, TContext>;
  transactionFlag: TransactionFlag;
  handlerRegistry: HandlerRegistry<TState, TAction, TContext>;
  getContext: () => TContext;
  getActorId?: () => string | undefined;
  getHistory: () => HistoryState<TAction>;
  setHistory: (state: HistoryState<TAction>) => void;
  markDirty?: (nodeIds: string[]) => void;
  source?: TransactionSource;
}

export function createTransactionMiddleware<
  TState,
  TAction extends { type: string },
  TContext extends RuntimeContext,
>(
  config: TransactionMiddlewareConfig<TState, TAction, TContext>,
): Middleware<TState, TAction> {
  const source = config.source ?? ("user" as TransactionSource);

  return (action, state, _next) => {
    const activeTx = config.transactionManager.getActiveTransaction();

    if (activeTx) {
      // Inside explicit multi-action transaction — route through TM
      config.transactionFlag.setActive(true);
      const result = config.transactionManager.applyAction(activeTx, action);
      config.transactionFlag.setActive(false);
      if (result.ok) {
        return { ok: true, state: activeTx.currentState };
      }
      return { ok: false, state: activeTx.preState, error: result.error };
    }

    // Implicit single-action transaction
    const context = config.getContext();
    config.transactionFlag.setActive(true);
    const tx = config.transactionManager.begin(source, state, context);
    const result = config.transactionManager.applyAction(tx, action);

    if (!result.ok) {
      config.transactionFlag.setActive(false);
      config.transactionManager.rollback(tx);
      return { ok: false, state, error: result.error };
    }

    const commitResult = config.transactionManager.commit(tx);

    if (!commitResult.ok) {
      config.transactionFlag.setActive(false);
      config.transactionManager.rollback(tx);
      return { ok: false, state, error: commitResult.error };
    }

    // Push transaction-level history entry
    const inverses = [...tx.appliedInverses].reverse();
    if (inverses.length > 0) {
      const currentHistory = config.getHistory();
      const actorId = config.getActorId?.() ?? context.actorId;
      const newHistory = pushUndoTransaction(
        currentHistory,
        [action],
        inverses,
        context.now(),
        actorId,
      );
      config.setHistory(newHistory);
    }

    // Mark dirty on scheduler
    config.markDirty?.(tx.tx.affectedNodes);

    config.transactionFlag.setActive(false);
    return { ok: true, state: commitResult.state };
  };
}
