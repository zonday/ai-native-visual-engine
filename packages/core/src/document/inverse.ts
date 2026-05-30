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
  batchEntry,
  createBatchHandler,
  createBatchInverse,
} from "./handlers/batch.js";
import { createPageEntry } from "./handlers/create-page.js";
import { removePageEntry } from "./handlers/remove-page.js";
import { renamePageEntry } from "./handlers/rename-page.js";
import { reorderPageEntry } from "./handlers/reorder-page.js";
import { setDocumentThemeEntry } from "./handlers/set-document-theme.js";
import { setPageThemeEntry } from "./handlers/set-page-theme.js";
import { updatePageRouteEntry } from "./handlers/update-page-route.js";

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
    ["create-page", createPageEntry as DocumentHandlerEntry],
    ["rename-page", renamePageEntry as DocumentHandlerEntry],
    ["remove-page", removePageEntry as DocumentHandlerEntry],
    ["reorder-page", reorderPageEntry as DocumentHandlerEntry],
    ["update-page-route", updatePageRouteEntry as DocumentHandlerEntry],
    ["set-document-theme", setDocumentThemeEntry as DocumentHandlerEntry],
    ["set-page-theme", setPageThemeEntry as DocumentHandlerEntry],
    [
      "batch-document-actions",
      {
        handler: createBatchHandler(
          batchDispatch,
        ) as DocumentHandlerEntry["handler"],
        inverse: batchEntry.inverse as InverseComputer,
        meta: { ...batchEntry.meta },
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
  const storedBatchEntry = docHandlerRegistry.get("batch-document-actions");
  if (storedBatchEntry) {
    docHandlerRegistry.set("batch-document-actions", {
      ...storedBatchEntry,
      inverse: batchInv as InverseComputer,
    });
  }
  docInvRegistry.set("batch-document-actions", batchInv as InverseComputer);

  return {
    handlerRegistry: handlerRegistry as Map<string, DocumentHandlerEntry>,
    inverseRegistry: inverseRegistry as InverseRegistry,
  };
}
