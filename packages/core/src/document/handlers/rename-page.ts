import type { RenamePageAction } from "../actions.js";
import { DocumentHandlerError } from "../error.js";
import type { DocumentHandler } from "../handler.js";

export const renamePageHandler: DocumentHandler<RenamePageAction> = (
  document,
  action,
  _ctx,
) => {
  const exists = document.pages.some((p) => p.id === action.pageId);
  if (!exists)
    throw new DocumentHandlerError(
      "document.page-not-found",
      `Page "${action.pageId}" not found`,
      "rename-page",
      action.pageId,
    );

  const pages = document.pages.map((p) =>
    p.id === action.pageId ? { ...p, name: action.name } : p,
  );
  return { ...document, pages };
};
