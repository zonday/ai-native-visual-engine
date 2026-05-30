import { produce } from "immer";
import { z } from "zod/v4";
import { HandlerError } from "../../engine/error.js";
import type { Page, VisualDocument } from "../../types.js";
import { PageSchema, PersistedSceneGraphSchema } from "../../types.js";
import type {
  DocumentHandler,
  DocumentRuntimeContext,
  InverseComputer,
} from "../handler-registry.js";
import { normalizeRoute } from "../normalize-route.js";

export const CreatePageActionSchema = z.object({
  type: z.literal("create-page"),
  page: PageSchema,
  scene: PersistedSceneGraphSchema,
});
export type CreatePageAction = z.infer<typeof CreatePageActionSchema>;

const createPageHandler: DocumentHandler<CreatePageAction> = (
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

  return produce(document, (draft) => {
    draft.scenes[page.sceneId] = action.scene;
    draft.pages.push(page);
  });
};

const createPageValidate = (
  document: VisualDocument,
  action: CreatePageAction,
  _ctx: DocumentRuntimeContext,
) => {
  const existingPage = document.pages.find((p) => p.id === action.page.id);
  if (existingPage) {
    return {
      ok: false,
      error: {
        code: "document.duplicate-page-id",
        message: `Page ID "${action.page.id}" already exists`,
      },
    };
  }
  const existingScene = document.scenes[action.page.sceneId];
  if (existingScene) {
    return {
      ok: false,
      error: {
        code: "document.duplicate-scene-id",
        message: `Scene ID "${action.page.sceneId}" already in use`,
      },
    };
  }
  if (action.page.route) {
    const canonicalRoute = normalizeRoute(action.page.route);
    const dup = document.pages.find((p) => p.route === canonicalRoute);
    if (dup) {
      return {
        ok: false,
        error: {
          code: "document.duplicate-route",
          message: `Route "${canonicalRoute}" already assigned to page "${dup.id}"`,
        },
      };
    }
  }
  return { ok: true };
};

const createPageInverse: InverseComputer<CreatePageAction> = (
  _documentBefore,
  action,
  _context,
) => {
  return {
    type: "remove-page",
    pageId: action.page.id,
  };
};

export const createPageEntry = {
  handler: createPageHandler,
  inverse: createPageInverse,
  validate: createPageValidate,
  meta: { undoable: true, mergeable: false, devtoolsLabel: "Create Page" },
};
