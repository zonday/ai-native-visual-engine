import type { Page } from "../../types.js";
import type { CreatePageAction } from "../actions.js";
import type { DocumentHandler } from "../handler.js";

export const createPageHandler: DocumentHandler<CreatePageAction> = (
  document,
  action,
  _ctx,
) => {
  const page: Page = {
    id: action.page.id,
    name: action.page.name,
    sceneId: action.page.sceneId,
    route: action.page.route,
    themeId: action.page.themeId,
  };

  const scenes = { ...document.scenes, [page.sceneId]: action.scene };
  const pages = [...document.pages, page];

  return { ...document, pages, scenes };
};
