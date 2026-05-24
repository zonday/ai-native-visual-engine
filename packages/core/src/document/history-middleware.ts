import type { DocumentHistoryEntry, DocumentHistoryState } from "./history.js";
import { pushDocumentUndo } from "./history.js";
import {
  computeInverseAction,
  type InverseRegistry,
} from "./inverse-registry.js";
import type { DocumentMiddleware } from "./middleware.js";

export function createUndoHistoryMiddleware(
  getHistory: () => DocumentHistoryState,
  setHistory: (state: DocumentHistoryState) => void,
  getActorId: () => string | undefined,
  registry: InverseRegistry,
): DocumentMiddleware {
  return (action, documentBefore, next) => {
    const result = next();

    if (result.ok) {
      const inverseAction = computeInverseAction(
        registry,
        documentBefore,
        action,
      );
      if (inverseAction) {
        const entry: DocumentHistoryEntry = {
          action,
          inverseAction,
          timestamp: Date.now(),
          actorId: getActorId(),
        };
        const newHistory = pushDocumentUndo(getHistory(), entry);
        setHistory(newHistory);
      }
    }

    return result;
  };
}
