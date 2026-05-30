import { z } from "zod/v4";
import { ActionRegistry } from "../engine/action-registry.js";
import type { VisualDocument } from "../types.js";
import type { DocumentRuntimeContext } from "./handler-registry.js";
import { BatchDocumentActionsSchema } from "./handlers/batch.js";
import {
  CreatePageActionSchema,
  createPageEntry,
} from "./handlers/create-page.js";
import {
  RemovePageActionSchema,
  removePageEntry,
} from "./handlers/remove-page.js";
import {
  RenamePageActionSchema,
  renamePageEntry,
} from "./handlers/rename-page.js";
import {
  ReorderPageActionSchema,
  reorderPageEntry,
} from "./handlers/reorder-page.js";
import {
  SetDocumentThemeActionSchema,
  setDocumentThemeEntry,
} from "./handlers/set-document-theme.js";
import {
  SetPageThemeActionSchema,
  setPageThemeEntry,
} from "./handlers/set-page-theme.js";
import {
  UpdatePageRouteActionSchema,
  updatePageRouteEntry,
} from "./handlers/update-page-route.js";

export const DocumentActionSchema = z.discriminatedUnion("type", [
  CreatePageActionSchema,
  RenamePageActionSchema,
  RemovePageActionSchema,
  ReorderPageActionSchema,
  UpdatePageRouteActionSchema,
  SetDocumentThemeActionSchema,
  SetPageThemeActionSchema,
  BatchDocumentActionsSchema,
]);

export type DocumentAction = z.infer<typeof DocumentActionSchema>;
export type BatchDocumentActions = z.infer<typeof BatchDocumentActionsSchema>;

export function createDocumentRegistry(): ActionRegistry<
  DocumentAction,
  VisualDocument,
  DocumentRuntimeContext
> {
  const registry = new ActionRegistry<
    DocumentAction,
    VisualDocument,
    DocumentRuntimeContext
  >();
  registry.register("create-page", createPageEntry);
  registry.register("rename-page", renamePageEntry);
  registry.register("remove-page", removePageEntry);
  registry.register("reorder-page", reorderPageEntry);
  registry.register("update-page-route", updatePageRouteEntry);
  registry.register("set-document-theme", setDocumentThemeEntry);
  registry.register("set-page-theme", setPageThemeEntry);
  registry.register("batch-document-actions", registry.createBatchEntry());
  return registry;
}
