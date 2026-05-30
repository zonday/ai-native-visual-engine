import { produce } from "immer";
import { HandlerError } from "../../engine/error.js";
import { z } from "zod/v4";
import type { VisualDocument } from "../../types.js";
import type { RemovePageAction } from "../actions.js";
import type {
  DocumentHandler,
  DocumentRuntimeContext,
  InverseComputer,
} from "../handler-registry.js";

export const RemovePageActionSchema = z.object({
  type: z.literal("remove-page"),
  pageId: z.string(),
});

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

const removePageValidate = (
  document: VisualDocument,
  action: RemovePageAction,
  _ctx: DocumentRuntimeContext,
) => {
  const page = document.pages.find((p) => p.id === action.pageId);
  if (!page) {
    return {
      ok: false,
      error: {
        code: "document.page-not-found",
        message: `Page "${action.pageId}" not found`,
      },
    };
  }
  return { ok: true };
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
  validate: removePageValidate,
  meta: { undoable: true, mergeable: false, devtoolsLabel: "Remove Page" },
};
