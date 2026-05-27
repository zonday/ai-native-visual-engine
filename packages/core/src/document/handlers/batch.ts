import { HandlerError } from "../../engine/error.js";
import type { VisualDocument } from "../../types.js";
import type { BatchDocumentActions, DocumentAction } from "../actions.js";
import { DocumentActionSchema } from "../actions.js";
import type { DocumentDispatchResult } from "../command-bus.js";
import type { DocumentHandler, DocumentRuntimeContext } from "../handler.js";
import type { InverseComputer } from "../handler-registry.js";

function flattenBatchActions(actions: DocumentAction[]): DocumentAction[] {
  const flat: DocumentAction[] = [];
  for (const action of actions) {
    if (action.type === "batch-document-actions") {
      const batch = action as BatchDocumentActions;
      flat.push(...flattenBatchActions(batch.actions as DocumentAction[]));
    } else {
      flat.push(action);
    }
  }
  return flat;
}

export function createBatchHandler(
  dispatch: (action: DocumentAction) => DocumentDispatchResult,
): DocumentHandler<BatchDocumentActions> {
  return (document, action, _ctx) => {
    const original = document;
    // Per spec §4.10: nested batch actions are flattened before execution.
    const flat = flattenBatchActions(action.actions as DocumentAction[]);
    let current = document;
    for (const child of flat) {
      // Validate each child action before dispatch
      const parsed = DocumentActionSchema.safeParse(child);
      if (!parsed.success) {
        throw new HandlerError(
          "document.batch-invalid-child-action",
          `Child action validation failed: ${parsed.error.message}`,
          "batch-document-actions",
        );
      }
      const result = dispatch(child);
      if (!result.ok) return original;
      current = result.document;
    }
    return current;
  };
}

export function computeBatchInverse(
  documentBefore: VisualDocument,
  action: BatchDocumentActions,
  dispatch: (action: DocumentAction) => DocumentDispatchResult,
  context: DocumentRuntimeContext,
  inverseOf: (
    docBefore: VisualDocument,
    action: DocumentAction,
    ctx: DocumentRuntimeContext,
  ) => DocumentAction | undefined,
): DocumentAction | undefined {
  const flat = flattenBatchActions(action.actions as DocumentAction[]);
  if (flat.length === 0) return undefined;

  const inverses: DocumentAction[] = [];
  let currentDoc = documentBefore;
  for (const child of flat) {
    const inv = inverseOf(currentDoc, child, context);
    if (inv) inverses.push(inv);
    const result = dispatch(child);
    if (!result.ok) break;
    currentDoc = result.document;
  }

  if (inverses.length === 0) return undefined;
  if (inverses.length === 1) return inverses[0];

  return {
    type: "batch-document-actions",
    actions: inverses.reverse(),
  };
}

// Spec §3.2: batch inverse should compose inverse actions in reverse order.
// This simple stub returns undefined. Batch undo via history middleware should
// use `computeBatchInverse` which has access to dispatch and the inverse registry.
export const batchInverse: InverseComputer<BatchDocumentActions> = (
  _documentBefore,
  _action,
  _context,
) => {
  return undefined;
};
