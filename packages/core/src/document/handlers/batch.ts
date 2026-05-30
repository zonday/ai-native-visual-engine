import { z } from "zod/v4";
import type { VisualDocument } from "../../types.js";
import type { DocumentDispatchResult } from "../document-command-bus.js";
import type {
  DocumentHandler,
  DocumentHandlerRegistry,
  DocumentRuntimeContext,
  InverseComputer,
  InverseRegistry,
} from "../handler-registry.js";
import { computeInverseAction } from "../handler-registry.js";
import type { DocumentAction } from "../register-handlers.js";

export const BatchDocumentActionsSchema = z.object({
  type: z.literal("batch-document-actions"),
  actions: z.array(z.unknown()),
});

export type BatchDocumentActions = z.infer<typeof BatchDocumentActionsSchema>;

const MAX_BATCH_DEPTH = 50;

function flattenBatchActions(
  actions: DocumentAction[],
  depth: number = 0,
): DocumentAction[] {
  if (depth > MAX_BATCH_DEPTH) return [];
  const flat: DocumentAction[] = [];
  for (const action of actions) {
    if (action.type === "batch-document-actions") {
      const batch = action as unknown as { actions: DocumentAction[] };
      flat.push(...flattenBatchActions(batch.actions, depth + 1));
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
    const flat = flattenBatchActions(action.actions as DocumentAction[]);
    let current = document;
    for (const child of flat) {
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
  dispatch: (
    document: VisualDocument,
    action: DocumentAction,
  ) => DocumentDispatchResult,
  context: DocumentRuntimeContext,
  inverseOf: (
    documentBefore: VisualDocument,
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
    const result = dispatch(currentDoc, child);
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

export const batchInverse: InverseComputer<BatchDocumentActions> = (
  _documentBefore,
  _action,
  _context,
) => {
  return undefined;
};

function createBatchInverse(
  handlerRegistry: DocumentHandlerRegistry,
  inverseRegistry: InverseRegistry,
): InverseComputer<BatchDocumentActions> {
  return (documentBefore, action, context) => {
    const dispatch = (
      docForAction: VisualDocument,
      childAction: DocumentAction,
    ): DocumentDispatchResult => {
      const entry = handlerRegistry.get(childAction.type);
      if (!entry) {
        return {
          ok: false,
          document: docForAction,
          error: {
            code: "document.unknown-action-type",
            message: `Unknown action type: ${childAction.type}`,
            actionType: childAction.type,
          },
        };
      }
      try {
        const next = entry.handler(docForAction, childAction, context);
        return { ok: true, document: next };
      } catch (err) {
        return {
          ok: false,
          document: docForAction,
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

const batchEntry = {
  handler: createBatchHandler,
  inverse: batchInverse,
  meta: { undoable: true, mergeable: true, devtoolsLabel: "Batch" },
};
