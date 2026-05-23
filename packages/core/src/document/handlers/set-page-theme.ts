import type { SetPageThemeAction } from "../actions.js";
import type { DocumentHandler } from "../handler.js";

export const setPageThemeHandler: DocumentHandler<SetPageThemeAction> = (
  document,
  action,
  _ctx,
) => {
  const pages = document.pages.map((p) =>
    p.id === action.pageId ? { ...p, themeId: action.themeId } : p,
  );
  return { ...document, pages };
};
