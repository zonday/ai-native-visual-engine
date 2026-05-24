import type { SetPageThemeAction } from "../actions.js";
import { DocumentHandlerError } from "../error.js";
import type { DocumentHandler } from "../handler.js";
import type { InverseComputer } from "../inverse-registry.js";

export const setPageThemeHandler: DocumentHandler<SetPageThemeAction> = (
  document,
  action,
  _ctx,
) => {
  const exists = document.pages.some((p) => p.id === action.pageId);
  if (!exists)
    throw new DocumentHandlerError(
      "document.page-not-found",
      `Page "${action.pageId}" not found`,
      "set-page-theme",
      action.pageId,
    );

  if (action.themeId !== undefined && document.themes) {
    const found = document.themes.some((t) => t.id === action.themeId);
    if (!found)
      throw new DocumentHandlerError(
        "document.theme-not-found",
        `Theme "${action.themeId}" not found in document themes`,
        "set-page-theme",
        action.pageId,
      );
  }

  const pages = document.pages.map((p) =>
    p.id === action.pageId ? { ...p, themeId: action.themeId } : p,
  );
  return { ...document, pages };
};

export const setPageThemeInverse: InverseComputer<SetPageThemeAction> = (
  documentBefore,
  action,
  _context,
) => {
  const page = documentBefore.pages.find((p) => p.id === action.pageId);
  if (!page) return undefined;
  return {
    type: "set-page-theme",
    pageId: action.pageId,
    themeId: page.themeId,
  };
};
