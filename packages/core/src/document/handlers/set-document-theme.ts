import type { SetDocumentThemeAction } from "../actions.js";
import type { DocumentHandler } from "../handler.js";

export const setDocumentThemeHandler: DocumentHandler<
  SetDocumentThemeAction
> = (document, action, _ctx) => {
  return { ...document, activeThemeId: action.themeId };
};
