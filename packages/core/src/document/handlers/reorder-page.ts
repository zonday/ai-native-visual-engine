import type { ReorderPageAction } from "../actions.js";
import { DocumentHandlerError } from "../error.js";
import type { DocumentHandler } from "../handler.js";
import type { InverseComputer } from "../inverse-registry.js";

export const reorderPageHandler: DocumentHandler<ReorderPageAction> = (
  document,
  action,
  _ctx,
) => {
  const idx = document.pages.findIndex((p) => p.id === action.pageId);
  if (idx === -1)
    throw new DocumentHandlerError(
      "document.page-not-found",
      `Page "${action.pageId}" not found`,
      "reorder-page",
      action.pageId,
    );

  if (action.index < 0 || action.index >= document.pages.length)
    throw new DocumentHandlerError(
      "document.index-out-of-bounds",
      `Index ${action.index} is out of bounds for ${document.pages.length} pages`,
      "reorder-page",
      action.pageId,
    );

  const pages = [...document.pages];
  const removed = pages.splice(idx, 1);
  pages.splice(action.index, 0, ...removed);

  return { ...document, pages };
};

export const reorderPageInverse: InverseComputer = (documentBefore, action) => {
  const reorderAction = action as ReorderPageAction;
  const idx = documentBefore.pages.findIndex(
    (p) => p.id === reorderAction.pageId,
  );
  if (idx === -1) return undefined;
  return {
    type: "reorder-page",
    pageId: reorderAction.pageId,
    index: idx,
  };
};
