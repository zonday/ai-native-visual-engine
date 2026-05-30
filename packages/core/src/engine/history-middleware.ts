import type { ActionRegistry } from "./action-registry.js";
import type { Middleware } from "./command-bus.js";
import type { RuntimeContext } from "./handler.js";
import type { HistoryEntry, HistoryState } from "./history.js";
import { pushUndo } from "./history.js";

export function createUndoHistoryMiddleware<
  TState,
  TAction extends { type: string },
  TContext extends RuntimeContext,
>(
  getHistory: () => HistoryState<TAction>,
  setHistory: (state: HistoryState<TAction>) => void,
  getActorId: () => string | undefined,
  registry: ActionRegistry<TAction, TState, TContext>,
  getContext: () => TContext,
  shouldExcludeFromUndo?: () => boolean,
  isInTransaction?: () => boolean,
): Middleware<TState, TAction> {
  return (action, stateBefore, next) => {
    const result = next();

    if (result.ok && !shouldExcludeFromUndo?.() && !isInTransaction?.()) {
      const inverseComputer = registry.getInverse(
        action.type as TAction["type"],
      );
      if (inverseComputer) {
        const context = getContext();
        const inverseAction = inverseComputer(stateBefore, action, context);
        if (inverseAction) {
          const historyEntry: HistoryEntry<TAction> = {
            action,
            inverseAction,
            timestamp: context.now(),
            actorId: getActorId() ?? context.actorId,
          };
          const newHistory = pushUndo(getHistory(), historyEntry);
          setHistory(newHistory);
        }
      }
    }

    return result;
  };
}
