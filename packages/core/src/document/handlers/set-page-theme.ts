import { produce } from "immer";
import { HandlerError } from "../../engine/error.js";
import type { SetPageThemeAction } from "../actions.js";
import type { DocumentHandler, InverseComputer } from "../handler-registry.js";

const setPageThemeHandler: DocumentHandler<SetPageThemeAction> = (
  document,
  action,
  _ctx,
) => {
  const exists = document.pages.some((p) => p.id === action.pageId);
  if (!exists)
    throw new HandlerError(
      "document.page-not-found",
      `Page "${action.pageId}" not found`,
      "set-page-theme",
      { pageId: action.pageId },
    );

  if (action.themeId !== undefined && document.themes) {
    const found = document.themes.some((t) => t.id === action.themeId);
    if (!found)
      throw new HandlerError(
        "document.theme-not-found",
        `Theme "${action.themeId}" not found in document themes`,
        "set-page-theme",
        { pageId: action.pageId },
      );
  }

  return produce(document, (draft) => {
    const page = draft.pages.find((p) => p.id === action.pageId);
    if (page) page.themeId = action.themeId;
  });
};

const setPageThemeInverse: InverseComputer<SetPageThemeAction> = (
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

export const setPageThemeEntry = {
  handler: setPageThemeHandler,
  inverse: setPageThemeInverse,
  meta: { undoable: true, mergeable: false, devtoolsLabel: "Set Page Theme" },
};
