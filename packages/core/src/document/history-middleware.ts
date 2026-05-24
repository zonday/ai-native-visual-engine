import type { DocumentRuntimeContext } from "./handler.js";
import type { DocumentHandlerRegistry } from "./handler-registry.js";
import type { DocumentHistoryEntry, DocumentHistoryState } from "./history.js";
import { pushDocumentUndo } from "./history.js";
import type { DocumentMiddleware } from "./middleware.js";

export function createUndoHistoryMiddleware(
  getHistory: () => DocumentHistoryState,
  setHistory: (state: DocumentHistoryState) => void,
  getActorId: () => string | undefined,
  registry: DocumentHandlerRegistry,
  getContext: () => DocumentRuntimeContext,
): DocumentMiddleware {
  return (action, documentBefore, next) => {
    const result = next();

    if (result.ok) {
      const entry = registry.get(action.type);
      const inverseComputer = entry?.inverse;
      if (inverseComputer) {
        const context = getContext();
        const inverseAction = inverseComputer(documentBefore, action, context);
        if (inverseAction) {
          const historyEntry: DocumentHistoryEntry = {
            action,
            inverseAction,
            timestamp: context.now(),
            actorId: getActorId() ?? context.actorId,
          };
          const newHistory = pushDocumentUndo(getHistory(), historyEntry);
          setHistory(newHistory);
        }
      }
    }

    return result;
  };
}
