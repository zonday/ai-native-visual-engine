import { produce } from "immer";
import { z } from "zod/v4";
import { HandlerError } from "../../engine/error.js";
import type { VisualDocument } from "../../types.js";
import type {
  DocumentHandler,
  DocumentRuntimeContext,
  InverseComputer,
} from "../handler-registry.js";

export const RenamePageActionSchema = z.object({
  type: z.literal("rename-page"),
  pageId: z.string(),
  name: z.string(),
});
export type RenamePageAction = z.infer<typeof RenamePageActionSchema>;

const renamePageHandler: DocumentHandler<RenamePageAction> = (
  document,
  action,
  _ctx,
) => {
  const exists = document.pages.some((p) => p.id === action.pageId);
  if (!exists)
    throw new HandlerError(
      "document.page-not-found",
      `Page "${action.pageId}" not found`,
      "rename-page",
      { pageId: action.pageId },
    );

  return produce(document, (draft) => {
    const page = draft.pages.find((p) => p.id === action.pageId);
    if (page) page.name = action.name;
  });
};

const renamePageValidate = (
  document: VisualDocument,
  action: RenamePageAction,
  _ctx: DocumentRuntimeContext,
) => {
  const exists = document.pages.some((p) => p.id === action.pageId);
  if (!exists) {
    return {
      ok: false,
      error: {
        code: "document.page-not-found",
        message: `Page "${action.pageId}" not found`,
      },
    };
  }
  return { ok: true };
};

const renamePageInverse: InverseComputer<RenamePageAction> = (
  documentBefore,
  action,
  _context,
) => {
  const page = documentBefore.pages.find((p) => p.id === action.pageId);
  if (!page) return undefined;
  return {
    type: "rename-page",
    pageId: action.pageId,
    name: page.name,
  };
};

export const renamePageEntry = {
  handler: renamePageHandler,
  inverse: renamePageInverse,
  validate: renamePageValidate,
  meta: { undoable: true, mergeable: false, devtoolsLabel: "Rename Page" },
};
