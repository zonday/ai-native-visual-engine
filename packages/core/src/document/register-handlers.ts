import { ActionRegistry } from "../engine/action-registry.js";
import type { VisualDocument } from "../types.js";
import type { DocumentAction } from "./actions.js";
import type { DocumentDispatchResult } from "./command-bus.js";
import type { DocumentRuntimeContext } from "./handler-registry.js";
import { createPageEntry } from "./handlers/create-page.js";
import { removePageEntry } from "./handlers/remove-page.js";
import { renamePageEntry } from "./handlers/rename-page.js";
import { reorderPageEntry } from "./handlers/reorder-page.js";
import { setDocumentThemeEntry } from "./handlers/set-document-theme.js";
import { setPageThemeEntry } from "./handlers/set-page-theme.js";
import { updatePageRouteEntry } from "./handlers/update-page-route.js";

export function createDocumentRegistry(): ActionRegistry<DocumentAction, VisualDocument, DocumentRuntimeContext> {
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
