import { ActionRegistry } from "../engine/action-registry.js";
import type { VisualDocument } from "../types.js";
import type { DocumentAction } from "./actions.js";
import type { DocumentDispatchResult } from "./command-bus.js";
import type {
  DocumentHandlerEntry,
  DocumentRuntimeContext,
} from "./handler-registry.js";
import { batchEntry, createBatchHandler } from "./handlers/batch.js";
import { createPageEntry } from "./handlers/create-page.js";
import { removePageEntry } from "./handlers/remove-page.js";
import { renamePageEntry } from "./handlers/rename-page.js";
import { reorderPageEntry } from "./handlers/reorder-page.js";
import { setDocumentThemeEntry } from "./handlers/set-document-theme.js";
import { setPageThemeEntry } from "./handlers/set-page-theme.js";
import { updatePageRouteEntry } from "./handlers/update-page-route.js";

export function createDocumentRegistry(
  batchDispatch: (action: DocumentAction) => DocumentDispatchResult,
): ActionRegistry<DocumentAction, VisualDocument, DocumentRuntimeContext> {
  const registry = new ActionRegistry<
    DocumentAction,
    VisualDocument,
    DocumentRuntimeContext
  >();

  registry.register("create-page", createPageEntry as DocumentHandlerEntry);
  registry.register("rename-page", renamePageEntry as DocumentHandlerEntry);
  registry.register("remove-page", removePageEntry as DocumentHandlerEntry);
  registry.register("reorder-page", reorderPageEntry as DocumentHandlerEntry);
  registry.register(
    "update-page-route",
    updatePageRouteEntry as DocumentHandlerEntry,
  );
  registry.register(
    "set-document-theme",
    setDocumentThemeEntry as DocumentHandlerEntry,
  );
  registry.register(
    "set-page-theme",
    setPageThemeEntry as DocumentHandlerEntry,
  );
  registry.register("batch-document-actions", {
    handler: createBatchHandler(
      batchDispatch,
    ) as DocumentHandlerEntry["handler"],
    inverse: batchEntry.inverse as DocumentHandlerEntry["inverse"],
    meta: { ...batchEntry.meta },
  });

  return registry;
}
