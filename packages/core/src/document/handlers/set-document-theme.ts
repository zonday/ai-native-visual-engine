import { HandlerError } from "../../engine/error.js";
import type { SetDocumentThemeAction } from "../actions.js";
import type { DocumentHandler, InverseComputer } from "../handler-registry.js";

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

export const setDocumentThemeMeta = {
  undoable: true,
  mergeable: false,
  devtoolsLabel: "Set Document Theme",
} as const;
