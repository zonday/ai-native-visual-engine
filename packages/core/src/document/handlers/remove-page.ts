import type { RemovePageAction } from "../actions.js";
import { DocumentHandlerError } from "../error.js";
import type { DocumentHandler } from "../handler.js";

export const removePageHandler: DocumentHandler<RemovePageAction> = (
  document,
  action,
  _ctx,
) => {
  const page = document.pages.find((p) => p.id === action.pageId);
  if (!page)
    throw new DocumentHandlerError(
      "document.page-not-found",
      `Page "${action.pageId}" not found`,
      "remove-page",
      action.pageId,
    );

  const pages = document.pages.filter((p) => p.id !== action.pageId);
  const scenes = { ...document.scenes };
  delete scenes[page.sceneId];

  return { ...document, pages, scenes };
};
