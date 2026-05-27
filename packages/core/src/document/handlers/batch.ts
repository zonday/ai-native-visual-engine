import { HandlerError } from "../../engine/error.js";
import type { VisualDocument } from "../../types.js";
import type { BatchDocumentActions, DocumentAction } from "../actions.js";
import { DocumentActionSchema } from "../actions.js";
import type { DocumentDispatchResult } from "../command-bus.js";
import type { DocumentHandler, DocumentRuntimeContext } from "../handler.js";
import type {
  DocumentHandlerRegistry,
  InverseComputer,
  InverseRegistry,
} from "../handler-registry.js";
import { computeInverseAction } from "../handler-registry.js";

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
// This simple stub returns undefined. Use createBatchInverse for a working
// implementation that has access to the handler and inverse registries.
export const batchInverse: InverseComputer<BatchDocumentActions> = (
  _documentBefore,
  _action,
  _context,
) => {
  return undefined;
};

export function createBatchInverse(
  handlerRegistry: DocumentHandlerRegistry,
  inverseRegistry: InverseRegistry,
): InverseComputer<BatchDocumentActions> {
  return (documentBefore, action, context) => {
    let currentDoc = documentBefore;
    const dispatch = (childAction: DocumentAction): DocumentDispatchResult => {
      const entry = handlerRegistry.get(childAction.type);
      if (!entry) {
        return {
          ok: false,
          document: currentDoc,
          error: {
            code: "document.unknown-action-type",
            message: `Unknown action type: ${childAction.type}`,
            actionType: childAction.type,
          },
        };
      }
      try {
        currentDoc = entry.handler(currentDoc, childAction, context);
        return { ok: true, document: currentDoc };
      } catch (err) {
        return {
          ok: false,
          document: currentDoc,
          error: {
            code: "document.handler-error",
            message: err instanceof Error ? err.message : String(err),
            actionType: childAction.type,
          },
        };
      }
    };

    const inverseOf = (
      d: VisualDocument,
      a: DocumentAction,
      ctx: DocumentRuntimeContext,
    ) => computeInverseAction(inverseRegistry, d, a, ctx);

    return computeBatchInverse(
      documentBefore,
      action,
      dispatch,
      context,
      inverseOf,
    );
  };
}
