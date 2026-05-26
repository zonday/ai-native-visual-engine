import type { DocumentAction } from "./actions.js";
import type { DocumentDispatchResult } from "./command-bus.js";
import type { DocumentHandlerEntry } from "./handler-registry.js";
import { batchInverse, createBatchHandler } from "./handlers/batch.js";
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
import type { InverseComputer, InverseRegistry } from "./handler-registry.js";
import { buildRegistriesFromEntries } from "../engine/handler-registry.js";
import {
  computeInverseAction,
  createInverseRegistry,
} from "./handler-registry.js";

export type { InverseComputer, InverseRegistry } from "./handler-registry.js";
export {
  computeInverseAction,
  createInverseRegistry,
} from "./handler-registry.js";

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
      },
    ],
    [
      "rename-page",
      {
        handler: renamePageHandler as DocumentHandlerEntry["handler"],
        inverse: renamePageInverse as InverseComputer,
      },
    ],
    [
      "remove-page",
      {
        handler: removePageHandler as DocumentHandlerEntry["handler"],
        inverse: removePageInverse as InverseComputer,
      },
    ],
    [
      "reorder-page",
      {
        handler: reorderPageHandler as DocumentHandlerEntry["handler"],
        inverse: reorderPageInverse as InverseComputer,
      },
    ],
    [
      "update-page-route",
      {
        handler: updatePageRouteHandler as DocumentHandlerEntry["handler"],
        inverse: updatePageRouteInverse as InverseComputer,
      },
    ],
    [
      "set-document-theme",
      {
        handler: setDocumentThemeHandler as DocumentHandlerEntry["handler"],
        inverse: setDocumentThemeInverse as InverseComputer,
      },
    ],
    [
      "set-page-theme",
      {
        handler: setPageThemeHandler as DocumentHandlerEntry["handler"],
        inverse: setPageThemeInverse as InverseComputer,
      },
    ],
    [
      "batch-document-actions",
      {
        handler: createBatchHandler(
          batchDispatch,
        ) as DocumentHandlerEntry["handler"],
        inverse: batchInverse as InverseComputer,
      },
    ],
  ];

  const { handlerRegistry, inverseRegistry } =
    buildRegistriesFromEntries(entries);
  return {
    handlerRegistry: handlerRegistry as Map<string, DocumentHandlerEntry>,
    inverseRegistry: inverseRegistry as InverseRegistry,
  };
}
