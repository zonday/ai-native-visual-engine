import type { SetDocumentThemeAction } from "../actions.js";
import { DocumentHandlerError } from "../error.js";
import type { DocumentHandler } from "../handler.js";

export const setDocumentThemeHandler: DocumentHandler<
  SetDocumentThemeAction
> = (document, action, _ctx) => {
  if (action.themeId !== undefined && document.themes) {
    const found = document.themes.some((t) => t.id === action.themeId);
    if (!found)
      throw new DocumentHandlerError(
        "document.theme-not-found",
        `Theme "${action.themeId}" not found in document themes`,
        "set-document-theme",
      );
  }

  return { ...document, activeThemeId: action.themeId };
};
