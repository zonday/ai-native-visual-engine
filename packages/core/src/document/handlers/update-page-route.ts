import type { UpdatePageRouteAction } from "../actions.js";
import { DocumentHandlerError } from "../error.js";
import type { DocumentHandler } from "../handler.js";
import type { InverseComputer } from "../inverse-registry.js";

const ROUTE_REGEX = /^\//;

export function normalizeRoute(route: string): string {
  const trimmed = route.trim();
  if (!trimmed) return "";
  let normalized = trimmed.toLowerCase();
  if (!ROUTE_REGEX.test(normalized)) {
    normalized = `/${normalized}`;
  }
  return normalized;
}

export const updatePageRouteHandler: DocumentHandler<UpdatePageRouteAction> = (
  document,
  action,
  _ctx,
) => {
  const exists = document.pages.some((p) => p.id === action.pageId);
  if (!exists)
    throw new DocumentHandlerError(
      "document.page-not-found",
      `Page "${action.pageId}" not found`,
      "update-page-route",
      action.pageId,
    );

  const normalized = normalizeRoute(action.route);
  if (!normalized)
    throw new DocumentHandlerError(
      "document.invalid-route",
      `Route is empty after normalization`,
      "update-page-route",
      action.pageId,
    );

  const duplicate = document.pages.find(
    (p) => p.route === normalized && p.id !== action.pageId,
  );
  if (duplicate)
    throw new DocumentHandlerError(
      "document.duplicate-route",
      `Route "${normalized}" already assigned to page "${duplicate.id}"`,
      "update-page-route",
      action.pageId,
    );

  const pages = document.pages.map((p) =>
    p.id === action.pageId ? { ...p, route: normalized } : p,
  );
  return { ...document, pages };
};

export const updatePageRouteInverse: InverseComputer = (
  documentBefore,
  action,
) => {
  const routeAction = action as UpdatePageRouteAction;
  const page = documentBefore.pages.find((p) => p.id === routeAction.pageId);
  if (!page) return undefined;
  return {
    type: "update-page-route",
    pageId: routeAction.pageId,
    route: page.route ?? "",
  };
};
