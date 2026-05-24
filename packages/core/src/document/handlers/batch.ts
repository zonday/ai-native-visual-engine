import type { BatchDocumentActions, DocumentAction } from "../actions.js";
import type { DocumentDispatchResult } from "../command-bus.js";
import type { DocumentHandler } from "../handler.js";

export function createBatchHandler(
  dispatch: (action: DocumentAction) => DocumentDispatchResult,
): DocumentHandler<BatchDocumentActions> {
  return (document, action, _ctx) => {
    const original = document;
    let current = document;
    for (const child of action.actions) {
      const result = dispatch(child as DocumentAction);
      if (!result.ok) return original;
      current = result.document;
    }
    return current;
  };
}
