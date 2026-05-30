import { buildRegistriesFromEntries } from "../engine/handler-registry.js";
import type { DocumentAction } from "./actions.js";
import type { DocumentDispatchResult } from "./command-bus.js";
import type {
  DocumentHandlerEntry,
  DocumentHandlerRegistry,
  InverseComputer,
  InverseRegistry,
} from "./handler-registry.js";
import {
  batchInverse,
  createBatchHandler,
  createBatchInverse,
  batchMeta,
} from "./handlers/batch.js";
import {
  createPageHandler,
  createPageInverse,
  createPageMeta,
} from "./handlers/create-page.js";
import {
  removePageHandler,
  removePageInverse,
  removePageMeta,
} from "./handlers/remove-page.js";
import {
  renamePageHandler,
  renamePageInverse,
  renamePageMeta,
} from "./handlers/rename-page.js";
import {
  reorderPageHandler,
  reorderPageInverse,
  reorderPageMeta,
} from "./handlers/reorder-page.js";
import {
  setDocumentThemeHandler,
  setDocumentThemeInverse,
  setDocumentThemeMeta,
} from "./handlers/set-document-theme.js";
import {
  setPageThemeHandler,
  setPageThemeInverse,
  setPageThemeMeta,
} from "./handlers/set-page-theme.js";
import {
  updatePageRouteHandler,
  updatePageRouteInverse,
  updatePageRouteMeta,
} from "./handlers/update-page-route.js";

export function createDefaultDocumentRegistries(
  batchDispatch: (action: DocumentAction) => DocumentDispatchResult,
): {
  handlerRegistry: Map<string, DocumentHandlerEntry>;
  inverseRegistry: InverseRegistry;
} {
  // Type assertions are required here due to TypeScript contravariance:
  // DocumentHandler<CreatePageAction> is not assignable to DocumentHandler<DocumentAction>
  // because function parameters are contravariant. Each handler and inverse are
  // fully type-safe within their own module; these casts widen to the union type
  // needed for the heterogeneous registry.
  const entries: [string, DocumentHandlerEntry][] = [
    [
      "create-page",
      {
        handler: createPageHandler as DocumentHandlerEntry["handler"],
        inverse: createPageInverse as InverseComputer,
        meta: createPageMeta,
      },
    ],
    [
      "rename-page",
      {
        handler: renamePageHandler as DocumentHandlerEntry["handler"],
        inverse: renamePageInverse as InverseComputer,
        meta: renamePageMeta,
      },
    ],
    [
      "remove-page",
      {
        handler: removePageHandler as DocumentHandlerEntry["handler"],
        inverse: removePageInverse as InverseComputer,
        meta: removePageMeta,
      },
    ],
    [
      "reorder-page",
      {
        handler: reorderPageHandler as DocumentHandlerEntry["handler"],
        inverse: reorderPageInverse as InverseComputer,
        meta: reorderPageMeta,
      },
    ],
    [
      "update-page-route",
      {
        handler: updatePageRouteHandler as DocumentHandlerEntry["handler"],
        inverse: updatePageRouteInverse as InverseComputer,
        meta: updatePageRouteMeta,
      },
    ],
    [
      "set-document-theme",
      {
        handler: setDocumentThemeHandler as DocumentHandlerEntry["handler"],
        inverse: setDocumentThemeInverse as InverseComputer,
        meta: setDocumentThemeMeta,
      },
    ],
    [
      "set-page-theme",
      {
        handler: setPageThemeHandler as DocumentHandlerEntry["handler"],
        inverse: setPageThemeInverse as InverseComputer,
        meta: setPageThemeMeta,
      },
    ],
    [
      "batch-document-actions",
      {
        handler: createBatchHandler(
          batchDispatch,
        ) as DocumentHandlerEntry["handler"],
        inverse: batchInverse as InverseComputer,
        meta: batchMeta,
      },
    ],
  ];

  // Build registries with batch inverse stub
  const { handlerRegistry, inverseRegistry } =
    buildRegistriesFromEntries(entries);

  const docInvRegistry = inverseRegistry as unknown as InverseRegistry;
  const docHandlerRegistry =
    handlerRegistry as unknown as DocumentHandlerRegistry;

  // Replace batch inverse with a proper one that has registry access
  const batchInv = createBatchInverse(docHandlerRegistry, docInvRegistry);
  const batchEntry = docHandlerRegistry.get("batch-document-actions");
  if (batchEntry) {
    docHandlerRegistry.set("batch-document-actions", {
      ...batchEntry,
      inverse: batchInv as InverseComputer,
    });
  }
  docInvRegistry.set("batch-document-actions", batchInv as InverseComputer);

  return {
    handlerRegistry: handlerRegistry as Map<string, DocumentHandlerEntry>,
    inverseRegistry: inverseRegistry as InverseRegistry,
  };
}
