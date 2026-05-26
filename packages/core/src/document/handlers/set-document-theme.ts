import type { SetDocumentThemeAction } from "../actions.js";
import { HandlerError } from "../../engine/error.js";
import type { DocumentHandler } from "../handler.js";
import type { InverseComputer } from "../handler-registry.js";

export const setDocumentThemeHandler: DocumentHandler<
  SetDocumentThemeAction
> = (document, action, _ctx) => {
  if (action.themeId !== undefined && document.themes) {
    const found = document.themes.some((t) => t.id === action.themeId);
    if (!found)
      throw new HandlerError(
        "document.theme-not-found",
        `Theme "${action.themeId}" not found in document themes`,
        "set-document-theme",
      );
  }

  return { ...document, activeThemeId: action.themeId };
};

export const setDocumentThemeInverse: InverseComputer<
  SetDocumentThemeAction
> = (documentBefore, _action, _context) => {
  return {
    type: "set-document-theme",
    themeId: documentBefore.activeThemeId,
  };
};
