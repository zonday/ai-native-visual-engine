import { HandlerError } from "../../engine/error.js";
import type { ReorderPageAction } from "../actions.js";
import type { DocumentHandler, InverseComputer } from "../handler-registry.js";

export const reorderPageHandler: DocumentHandler<ReorderPageAction> = (
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

  const pages = [...document.pages];
  const removed = pages.splice(idx, 1);
  pages.splice(action.index, 0, ...removed);

  return { ...document, pages };
};

export const reorderPageInverse: InverseComputer<ReorderPageAction> = (
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
