import type { RemovePageAction } from "../actions.js";
import type { DocumentHandler } from "../handler.js";

export const removePageHandler: DocumentHandler<RemovePageAction> = (
  document,
  action,
  _ctx,
) => {
  const page = document.pages.find((p) => p.id === action.pageId);
  if (!page) return document;

  const pages = document.pages.filter((p) => p.id !== action.pageId);
  const scenes = { ...document.scenes };
  delete scenes[page.sceneId];

  return { ...document, pages, scenes };
};
