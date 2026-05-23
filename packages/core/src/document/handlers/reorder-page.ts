import type { ReorderPageAction } from "../actions.js";
import type { DocumentHandler } from "../handler.js";

export const reorderPageHandler: DocumentHandler<ReorderPageAction> = (
  document,
  action,
  _ctx,
) => {
  const idx = document.pages.findIndex((p) => p.id === action.pageId);
  if (idx === -1) return document;

  const clampedIdx = Math.min(action.index, document.pages.length - 1);
  const pages = [...document.pages];
  const [moved] = pages.splice(idx, 1);
  if (moved) {
    pages.splice(clampedIdx, 0, moved);
  }

  return { ...document, pages };
};
