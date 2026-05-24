import type { RuntimeContext } from "./handler.js";
import type { RuntimeHandlerRegistry } from "./handler-registry.js";
import type { RuntimeHistoryEntry, RuntimeHistoryState } from "./history.js";
import { pushRuntimeUndo } from "./history.js";
import type { RuntimeMiddleware } from "./middleware.js";

export function createUndoHistoryMiddleware(
  getHistory: () => RuntimeHistoryState,
  setHistory: (state: RuntimeHistoryState) => void,
  getActorId: () => string | undefined,
  registry: RuntimeHandlerRegistry,
  getContext: () => RuntimeContext,
): RuntimeMiddleware {
  return (action, sceneBefore, next) => {
    const result = next();

    if (result.ok) {
      const entry = registry.get(action.type);
      const inverseComputer = entry?.inverse;
      if (inverseComputer) {
        const context = getContext();
        const inverseAction = inverseComputer(sceneBefore, action, context);
        if (inverseAction) {
          const historyEntry: RuntimeHistoryEntry = {
            action,
            inverseAction,
            timestamp: context.now(),
            actorId: getActorId() ?? context.actorId,
          };
          const newHistory = pushRuntimeUndo(getHistory(), historyEntry);
          setHistory(newHistory);
        }
      }
    }

    return result;
  };
}
