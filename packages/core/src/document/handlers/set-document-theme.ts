import { produce } from "immer";
import { HandlerError } from "../../engine/error.js";
import type { SetDocumentThemeAction } from "../actions.js";
import type { DocumentHandler, InverseComputer } from "../handler-registry.js";

const setDocumentThemeHandler: DocumentHandler<SetDocumentThemeAction> = (
  document,
  action,
  _ctx,
) => {
  if (action.themeId !== undefined && document.themes) {
    const found = document.themes.some((t) => t.id === action.themeId);
    if (!found)
      throw new HandlerError(
        "document.theme-not-found",
        `Theme "${action.themeId}" not found in document themes`,
        "set-document-theme",
      );
  }

  return produce(document, (draft) => {
    draft.activeThemeId = action.themeId;
  });
};

const setDocumentThemeInverse: InverseComputer<SetDocumentThemeAction> = (
  documentBefore,
  _action,
  _context,
) => {
  return {
    type: "set-document-theme",
    themeId: documentBefore.activeThemeId,
  };
};

export const setDocumentThemeEntry = {
  handler: setDocumentThemeHandler,
  inverse: setDocumentThemeInverse,
  meta: {
    undoable: true,
    mergeable: false,
    devtoolsLabel: "Set Document Theme",
  },
};
