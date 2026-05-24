import type { Middleware } from "./command-bus.js";
import type { RuntimeContext } from "./handler.js";
import type { HandlerRegistry } from "./handler-registry.js";
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
  registry: HandlerRegistry<TState, TAction, TContext>,
  getContext: () => TContext,
): Middleware<TState, TAction> {
  return (action, stateBefore, next) => {
    const result = next();

    if (result.ok) {
      const entry = registry.get(action.type);
      const inverseComputer = entry?.inverse;
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
