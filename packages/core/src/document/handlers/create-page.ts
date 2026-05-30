import { HandlerError } from "../../engine/error.js";
import type { Page } from "../../types.js";
import type { CreatePageAction } from "../actions.js";
import type { DocumentHandler, InverseComputer } from "../handler-registry.js";
import { normalizeRoute } from "../normalize-route.js";

export const createPageHandler: DocumentHandler<CreatePageAction> = (
  document,
  action,
  _ctx,
) => {
  const existingPage = document.pages.find((p) => p.id === action.page.id);
  if (existingPage)
    throw new HandlerError(
      "document.duplicate-page-id",
      `Page ID "${action.page.id}" already exists`,
      "create-page",
      { pageId: action.page.id },
    );

  const existingScene = document.scenes[action.page.sceneId];
  if (existingScene)
    throw new HandlerError(
      "document.duplicate-scene-id",
      `Scene ID "${action.page.sceneId}" already in use`,
      "create-page",
    );

  if (action.page.route) {
    const canonicalRoute = normalizeRoute(action.page.route);
    const dup = document.pages.find((p) => p.route === canonicalRoute);
    if (dup)
      throw new HandlerError(
        "document.duplicate-route",
        `Route "${canonicalRoute}" already assigned to page "${dup.id}"`,
        "create-page",
        { pageId: action.page.id },
      );
  }

  const page: Page = {
    id: action.page.id,
    name: action.page.name,
    sceneId: action.page.sceneId,
    route: action.page.route ? normalizeRoute(action.page.route) : undefined,
    themeId: action.page.themeId,
    metadata: action.page.metadata,
  };

  const scenes = { ...document.scenes, [page.sceneId]: action.scene };
  const pages = [...document.pages, page];

  return { ...document, pages, scenes };
};

export const createPageInverse: InverseComputer<CreatePageAction> = (
  _documentBefore,
  action,
  _context,
) => {
  return {
    type: "remove-page",
    pageId: action.page.id,
  };
};
