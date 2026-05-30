import { produce } from "immer";
import { z } from "zod/v4";
import { HandlerError } from "../../engine/error.js";
import type { VisualDocument } from "../../types.js";
import type {
  DocumentHandler,
  DocumentRuntimeContext,
  InverseComputer,
} from "../handler-registry.js";

export const ReorderPageActionSchema = z.object({
  type: z.literal("reorder-page"),
  pageId: z.string(),
  index: z.number().int().min(0),
});
export type ReorderPageAction = z.infer<typeof ReorderPageActionSchema>;

const reorderPageHandler: DocumentHandler<ReorderPageAction> = (
  document,
  action,
  _ctx,
) => {
  const idx = document.pages.findIndex((p) => p.id === action.pageId);
  if (idx === -1)
    throw new HandlerError(
      "document.page-not-found",
      `Page "${action.pageId}" not found`,
      "reorder-page",
      { pageId: action.pageId },
    );

  if (action.index < 0 || action.index >= document.pages.length)
    throw new HandlerError(
      "document.index-out-of-bounds",
      `Index ${action.index} is out of bounds for ${document.pages.length} pages`,
      "reorder-page",
      { pageId: action.pageId },
    );

  return produce(document, (draft) => {
    const removed = draft.pages.splice(idx, 1);
    draft.pages.splice(action.index, 0, ...removed);
  });
};

const reorderPageValidate = (
  document: VisualDocument,
  action: ReorderPageAction,
  _ctx: DocumentRuntimeContext,
) => {
  const idx = document.pages.findIndex((p) => p.id === action.pageId);
  if (idx === -1) {
    return {
      ok: false,
      error: {
        code: "document.page-not-found",
        message: `Page "${action.pageId}" not found`,
      },
    };
  }
  if (action.index < 0 || action.index >= document.pages.length) {
    return {
      ok: false,
      error: {
        code: "document.index-out-of-bounds",
        message: `Index ${action.index} is out of bounds for ${document.pages.length} pages`,
      },
    };
  }
  return { ok: true };
};

const reorderPageInverse: InverseComputer<ReorderPageAction> = (
  documentBefore,
  action,
  _context,
) => {
  const idx = documentBefore.pages.findIndex((p) => p.id === action.pageId);
  if (idx === -1) return undefined;
  return {
    type: "reorder-page",
    pageId: action.pageId,
    index: idx,
  };
};

export const reorderPageEntry = {
  handler: reorderPageHandler,
  inverse: reorderPageInverse,
  validate: reorderPageValidate,
  meta: { undoable: true, mergeable: false, devtoolsLabel: "Reorder Page" },
};
