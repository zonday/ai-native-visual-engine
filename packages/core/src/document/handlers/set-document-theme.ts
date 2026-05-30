import { produce } from "immer";
import { HandlerError } from "../../engine/error.js";
import { z } from "zod/v4";
import type { VisualDocument } from "../../types.js";
import type { SetDocumentThemeAction } from "../actions.js";
import type {
  DocumentHandler,
  DocumentRuntimeContext,
  InverseComputer,
} from "../handler-registry.js";

export const SetDocumentThemeActionSchema = z.object({
  type: z.literal("set-document-theme"),
  themeId: z.string().optional(),
});

const setDocumentThemeHandler: DocumentHandler<SetDocumentThemeAction> = (
  document,
  action,
  _ctx,
) => {
  if (action.themeId !== undefined && document.themes) {
    const found = document.themes.some((t) => t.id === action.themeId);
    if (!found)
      throw new HandlerError(
        "document.theme-not-found",
        `Theme "${action.themeId}" not found in document themes`,
        "set-document-theme",
      );
  }

  return produce(document, (draft) => {
    draft.activeThemeId = action.themeId;
  });
};

const setDocumentThemeValidate = (
  document: VisualDocument,
  action: SetDocumentThemeAction,
  _ctx: DocumentRuntimeContext,
) => {
  if (action.themeId !== undefined && document.themes) {
    const found = document.themes.some((t) => t.id === action.themeId);
    if (!found) {
      return {
        ok: false,
        error: {
          code: "document.theme-not-found",
          message: `Theme "${action.themeId}" not found in document themes`,
        },
      };
    }
  }
  return { ok: true };
};

const setDocumentThemeInverse: InverseComputer<SetDocumentThemeAction> = (
  documentBefore,
  _action,
  _context,
) => {
  return {
    type: "set-document-theme",
    themeId: documentBefore.activeThemeId,
  };
};

export const setDocumentThemeEntry = {
  handler: setDocumentThemeHandler,
  inverse: setDocumentThemeInverse,
  validate: setDocumentThemeValidate,
  meta: {
    undoable: true,
    mergeable: false,
    devtoolsLabel: "Set Document Theme",
  },
};
