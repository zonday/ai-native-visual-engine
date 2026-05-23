import type { RenamePageAction } from "../actions.js";
import type { DocumentHandler } from "../handler.js";

export const renamePageHandler: DocumentHandler<RenamePageAction> = (
  document,
  action,
  _ctx,
) => {
  const pages = document.pages.map((p) =>
    p.id === action.pageId ? { ...p, name: action.name } : p,
  );
  return { ...document, pages };
};
