import { produce } from "immer";
import { z } from "zod/v4";
import { HandlerError } from "../../engine/error.js";
import type { VisualDocument } from "../../types.js";
import type {
  DocumentHandler,
  DocumentRuntimeContext,
  InverseComputer,
} from "../handler-registry.js";
import { normalizeRoute } from "../normalize-route.js";

export const UpdatePageRouteActionSchema = z.object({
  type: z.literal("update-page-route"),
  pageId: z.string(),
  route: z.string(),
});
export type UpdatePageRouteAction = z.infer<typeof UpdatePageRouteActionSchema>;

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

const updatePageRouteValidate = (
  document: VisualDocument,
  action: UpdatePageRouteAction,
  _ctx: DocumentRuntimeContext,
) => {
  const exists = document.pages.some((p) => p.id === action.pageId);
  if (!exists) {
    return {
      ok: false,
      error: {
        code: "document.page-not-found",
        message: `Page "${action.pageId}" not found`,
      },
    };
  }
  const normalized = normalizeRoute(action.route);
  if (!normalized) {
    return {
      ok: false,
      error: {
        code: "document.invalid-route",
        message: "Route is empty after normalization",
      },
    };
  }
  const duplicate = document.pages.find(
    (p) => p.route === normalized && p.id !== action.pageId,
  );
  if (duplicate) {
    return {
      ok: false,
      error: {
        code: "document.duplicate-route",
        message: `Route "${normalized}" already assigned to page "${duplicate.id}"`,
      },
    };
  }
  return { ok: true };
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
  validate: updatePageRouteValidate,
  meta: {
    undoable: true,
    mergeable: false,
    devtoolsLabel: "Update Page Route",
  },
};
