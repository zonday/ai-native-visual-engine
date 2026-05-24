import type { RenamePageAction } from "../actions.js";
import { DocumentHandlerError } from "../error.js";
import type { DocumentHandler } from "../handler.js";
import type { InverseComputer } from "../inverse-registry.js";

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

export const renamePageInverse: InverseComputer = (documentBefore, action) => {
  const page = documentBefore.pages.find(
    (p) => p.id === (action as RenamePageAction).pageId,
  );
  if (!page) return undefined;
  return {
    type: "rename-page",
    pageId: (action as RenamePageAction).pageId,
    name: page.name,
  };
};
