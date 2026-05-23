import type { UpdatePageRouteAction } from "../actions.js";
import type { DocumentHandler } from "../handler.js";

export const ROUTE_REGEX = /^\//;

export function normalizeRoute(route: string): string {
  let normalized = route.trim().toLowerCase();
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
  const normalized = normalizeRoute(action.route);
  if (
    !normalized ||
    (normalized === "/" &&
      document.pages.some((p) => p.route === "/" && p.id !== action.pageId))
  )
    return document;

  const pages = document.pages.map((p) =>
    p.id === action.pageId ? { ...p, route: normalized } : p,
  );
  return { ...document, pages };
};
