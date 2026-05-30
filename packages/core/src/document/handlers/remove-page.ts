import { produce } from "immer";
import { HandlerError } from "../../engine/error.js";
import type { RemovePageAction } from "../actions.js";
import type { DocumentHandler, InverseComputer } from "../handler-registry.js";

const removePageHandler: DocumentHandler<RemovePageAction> = (
  document,
  action,
  _ctx,
) => {
  const page = document.pages.find((p) => p.id === action.pageId);
  if (!page)
    throw new HandlerError(
      "document.page-not-found",
      `Page "${action.pageId}" not found`,
      "remove-page",
      { pageId: action.pageId },
    );

  return produce(document, (draft) => {
    draft.pages = document.pages.filter((p) => p.id !== action.pageId);
    delete draft.scenes[page.sceneId];
  });
};

const removePageInverse: InverseComputer<RemovePageAction> = (
  documentBefore,
  action,
  _context,
) => {
  const page = documentBefore.pages.find((p) => p.id === action.pageId);
  const scene = documentBefore.scenes[page?.sceneId ?? ""];
  if (!page || !scene) return undefined;
  return {
    type: "create-page",
    page: {
      id: page.id,
      name: page.name,
      sceneId: page.sceneId,
      route: page.route,
      themeId: page.themeId,
      metadata: page.metadata,
    },
    scene,
  };
};

export const removePageEntry = {
  handler: removePageHandler,
  inverse: removePageInverse,
  meta: { undoable: true, mergeable: false, devtoolsLabel: "Remove Page" },
};
