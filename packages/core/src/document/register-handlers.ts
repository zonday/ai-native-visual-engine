import { ActionRegistry, splitRegistry } from "../engine/action-registry.js";
import type { DocumentAction } from "./actions.js";
import type { DocumentDispatchResult } from "./command-bus.js";
import type { DocumentHandlerEntry, InverseRegistry, DocumentHandlerRegistry } from "./handler-registry.js";
import { createBatchHandler } from "./handlers/batch.js";
import { createPageEntry } from "./handlers/create-page.js";
import { removePageEntry } from "./handlers/remove-page.js";
import { renamePageEntry } from "./handlers/rename-page.js";
import { reorderPageEntry } from "./handlers/reorder-page.js";
import { setDocumentThemeEntry } from "./handlers/set-document-theme.js";
import { setPageThemeEntry } from "./handlers/set-page-theme.js";
import { updatePageRouteEntry } from "./handlers/update-page-route.js";
import type { VisualDocument } from "../types.js";
import type { DocumentRuntimeContext } from "./handler-registry.js";

function entry(
  h: DocumentHandlerEntry["handler"],
  i: DocumentHandlerEntry["inverse"],
): any {
  return { handler: h, inverse: i, meta: { undoable: true, mergeable: false, devtoolsLabel: "" } };
}

export function createDocumentRegistry(
  batchDispatch: (action: DocumentAction) => DocumentDispatchResult,
): ActionRegistry<DocumentAction, VisualDocument, DocumentRuntimeContext> {
  const registry = new ActionRegistry<DocumentAction, VisualDocument, DocumentRuntimeContext>();
  registry.register("create-page", entry(createPageEntry.handler as DocumentHandlerEntry["handler"], createPageEntry.inverse as DocumentHandlerEntry["inverse"]));
  registry.register("rename-page", entry(renamePageEntry.handler as DocumentHandlerEntry["handler"], renamePageEntry.inverse as DocumentHandlerEntry["inverse"]));
  registry.register("remove-page", entry(removePageEntry.handler as DocumentHandlerEntry["handler"], removePageEntry.inverse as DocumentHandlerEntry["inverse"]));
  registry.register("reorder-page", entry(reorderPageEntry.handler as DocumentHandlerEntry["handler"], reorderPageEntry.inverse as DocumentHandlerEntry["inverse"]));
  registry.register("update-page-route", entry(updatePageRouteEntry.handler as DocumentHandlerEntry["handler"], updatePageRouteEntry.inverse as DocumentHandlerEntry["inverse"]));
  registry.register("set-document-theme", entry(setDocumentThemeEntry.handler as DocumentHandlerEntry["handler"], setDocumentThemeEntry.inverse as DocumentHandlerEntry["inverse"]));
  registry.register("set-page-theme", entry(setPageThemeEntry.handler as DocumentHandlerEntry["handler"], setPageThemeEntry.inverse as DocumentHandlerEntry["inverse"]));
  registry.register("batch-document-actions", registry.createBatchEntry() as any);
  return registry;
}

/** @deprecated Use createDocumentRegistry + ActionRegistry instead */
export function createDefaultDocumentRegistries(
  batchDispatch: (action: DocumentAction) => DocumentDispatchResult,
): { handlerRegistry: DocumentHandlerRegistry; inverseRegistry: InverseRegistry } {
  const registry = createDocumentRegistry(batchDispatch);
  const split = splitRegistry(registry);
  return {
    handlerRegistry: split.handlerRegistry as unknown as DocumentHandlerRegistry,
    inverseRegistry: split.inverseRegistry as unknown as InverseRegistry,
  };
}
