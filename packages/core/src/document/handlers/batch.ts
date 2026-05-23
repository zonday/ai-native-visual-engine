import type { BatchDocumentActions, DocumentAction } from "../actions.js";
import type { DocumentDispatchResult } from "../command-bus.js";
import type { DocumentHandler } from "../handler.js";

export function createBatchHandler(
  dispatch: (action: DocumentAction) => DocumentDispatchResult,
): DocumentHandler<BatchDocumentActions> {
  return (document, action, _ctx) => {
    let current = document;
    for (const child of action.actions) {
      const result = dispatch(child);
      if (!result.ok) return current;
      current = result.document;
    }
    return current;
  };
}
