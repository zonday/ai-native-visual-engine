import { HandlerError } from "../../engine/error.js";
import type { RenamePageAction } from "../actions.js";
import type { DocumentHandler, InverseComputer } from "../handler-registry.js";

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

  const pages = document.pages.map((p) =>
    p.id === action.pageId ? { ...p, name: action.name } : p,
  );
  return { ...document, pages };
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
  meta: { undoable: true, mergeable: false, devtoolsLabel: "Rename Page" },
};
