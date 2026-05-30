import { ActionRegistry } from "../engine/action-registry.js";
import type { VisualDocument } from "../types.js";
import type { DocumentAction } from "./actions.js";
import type { DocumentDispatchResult } from "./command-bus.js";
import type {
  DocumentHandlerEntry,
  DocumentRuntimeContext,
} from "./handler-registry.js";
import { createBatchHandler } from "./handlers/batch.js";
import {
  createPageHandler,
  createPageInverse,
} from "./handlers/create-page.js";
import {
  removePageHandler,
  removePageInverse,
} from "./handlers/remove-page.js";
import {
  renamePageHandler,
  renamePageInverse,
} from "./handlers/rename-page.js";
import {
  reorderPageHandler,
  reorderPageInverse,
} from "./handlers/reorder-page.js";
import {
  setDocumentThemeHandler,
  setDocumentThemeInverse,
} from "./handlers/set-document-theme.js";
import {
  setPageThemeHandler,
  setPageThemeInverse,
} from "./handlers/set-page-theme.js";
import {
  updatePageRouteHandler,
  updatePageRouteInverse,
} from "./handlers/update-page-route.js";

function entry(
  handler: DocumentHandlerEntry["handler"],
  inverse: DocumentHandlerEntry["inverse"],
) {
  return {
    handler,
    inverse,
    meta: { undoable: true, mergeable: false, devtoolsLabel: "" },
  };
}

export function createDocumentRegistry(
  batchDispatch: (action: DocumentAction) => DocumentDispatchResult,
): ActionRegistry<DocumentAction, VisualDocument, DocumentRuntimeContext> {
  const registry = new ActionRegistry<
    DocumentAction,
    VisualDocument,
    DocumentRuntimeContext
  >();

  registry.register(
    "create-page",
    entry(
      createPageHandler as DocumentHandlerEntry["handler"],
      createPageInverse as DocumentHandlerEntry["inverse"],
    ),
  );
  registry.register(
    "rename-page",
    entry(
      renamePageHandler as DocumentHandlerEntry["handler"],
      renamePageInverse as DocumentHandlerEntry["inverse"],
    ),
  );
  registry.register(
    "remove-page",
    entry(
      removePageHandler as DocumentHandlerEntry["handler"],
      removePageInverse as DocumentHandlerEntry["inverse"],
    ),
  );
  registry.register(
    "reorder-page",
    entry(
      reorderPageHandler as DocumentHandlerEntry["handler"],
      reorderPageInverse as DocumentHandlerEntry["inverse"],
    ),
  );
  registry.register(
    "update-page-route",
    entry(
      updatePageRouteHandler as DocumentHandlerEntry["handler"],
      updatePageRouteInverse as DocumentHandlerEntry["inverse"],
    ),
  );
  registry.register(
    "set-document-theme",
    entry(
      setDocumentThemeHandler as DocumentHandlerEntry["handler"],
      setDocumentThemeInverse as DocumentHandlerEntry["inverse"],
    ),
  );
  registry.register(
    "set-page-theme",
    entry(
      setPageThemeHandler as DocumentHandlerEntry["handler"],
      setPageThemeInverse as DocumentHandlerEntry["inverse"],
    ),
  );
  registry.register(
    "batch-document-actions",
    entry(
      createBatchHandler(batchDispatch) as DocumentHandlerEntry["handler"],
      (() => undefined) as DocumentHandlerEntry["inverse"],
    ),
  );

  return registry;
}
