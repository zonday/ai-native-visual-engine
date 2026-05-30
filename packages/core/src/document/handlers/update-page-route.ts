import { produce } from "immer";
import { HandlerError } from "../../engine/error.js";
import type { UpdatePageRouteAction } from "../actions.js";
import type { DocumentHandler, InverseComputer } from "../handler-registry.js";
import { normalizeRoute } from "../normalize-route.js";

const updatePageRouteHandler: DocumentHandler<UpdatePageRouteAction> = (
  document,
  action,
  _ctx,
) => {
  const exists = document.pages.some((p) => p.id === action.pageId);
  if (!exists)
    throw new HandlerError(
      "document.page-not-found",
      `Page "${action.pageId}" not found`,
      "update-page-route",
      { pageId: action.pageId },
    );

  const normalized = normalizeRoute(action.route);
  if (!normalized)
    throw new HandlerError(
      "document.invalid-route",
      `Route is empty after normalization`,
      "update-page-route",
      { pageId: action.pageId },
    );

  const duplicate = document.pages.find(
    (p) => p.route === normalized && p.id !== action.pageId,
  );
  if (duplicate)
    throw new HandlerError(
      "document.duplicate-route",
      `Route "${normalized}" already assigned to page "${duplicate.id}"`,
      "update-page-route",
      { pageId: action.pageId },
    );

  return produce(document, (draft) => {
    const page = draft.pages.find((p) => p.id === action.pageId);
    if (page) page.route = normalized;
  });
};

const updatePageRouteInverse: InverseComputer<UpdatePageRouteAction> = (
  documentBefore,
  action,
  _context,
) => {
  const page = documentBefore.pages.find((p) => p.id === action.pageId);
  if (!page) return undefined;
  return {
    type: "update-page-route",
    pageId: action.pageId,
    route: page.route ?? "",
  };
};

export const updatePageRouteEntry = {
  handler: updatePageRouteHandler,
  inverse: updatePageRouteInverse,
  meta: {
    undoable: true,
    mergeable: false,
    devtoolsLabel: "Update Page Route",
  },
};
