import { buildRegistriesFromEntries } from "../engine/handler-registry.js";
import type { RuntimeAction } from "./actions.js";
import type { DispatchResult } from "./command-bus.js";
import type {
  InverseComputer,
  InverseRegistry,
  RuntimeHandlerEntry,
  RuntimeHandlerRegistry,
} from "./handler-registry.js";
import {
  batchInverse,
  createBatchHandler,
  createBatchInverse,
  batchMeta,
} from "./handlers/batch.js";
import {
  createNodeHandler,
  createNodeInverse,
  createNodeMeta,
} from "./handlers/create-node.js";
import {
  moveNodeHandler,
  moveNodeInverse,
  moveNodeMeta,
} from "./handlers/move-node.js";
import {
  removeNodeHandler,
  removeNodeInverse,
  removeNodeMeta,
} from "./handlers/remove-node.js";
import {
  rotateNodeHandler,
  rotateNodeInverse,
  rotateNodeMeta,
} from "./handlers/rotate-node.js";
import {
  updateBindingsHandler,
  updateBindingsInverse,
  updateBindingsMeta,
} from "./handlers/update-bindings.js";
import {
  updateLayoutHandler,
  updateLayoutInverse,
  updateLayoutMeta,
} from "./handlers/update-layout.js";
import {
  updatePropsHandler,
  updatePropsInverse,
  updatePropsMeta,
} from "./handlers/update-props.js";
import {
  updateRuntimeHandler,
  updateRuntimeInverse,
  updateRuntimeMeta,
} from "./handlers/update-runtime.js";
import {
  updateSelectionHandler,
  updateSelectionInverse,
  updateSelectionMeta,
} from "./handlers/update-selection.js";
import {
  updateStyleHandler,
  updateStyleInverse,
  updateStyleMeta,
} from "./handlers/update-style.js";

export function createDefaultRuntimeRegistries(
  _batchDispatch: (action: RuntimeAction) => DispatchResult,
): {
  handlerRegistry: Map<string, RuntimeHandlerEntry>;
  inverseRegistry: InverseRegistry;
} {
  const entries: [string, RuntimeHandlerEntry][] = [
    [
      "create-node",
      {
        handler: createNodeHandler as RuntimeHandlerEntry["handler"],
        inverse: createNodeInverse as InverseComputer,
        meta: createNodeMeta,
      },
    ],
    [
      "remove-node",
      {
        handler: removeNodeHandler as RuntimeHandlerEntry["handler"],
        inverse: removeNodeInverse as InverseComputer,
        meta: removeNodeMeta,
      },
    ],
    [
      "move-node",
      {
        handler: moveNodeHandler as RuntimeHandlerEntry["handler"],
        inverse: moveNodeInverse as InverseComputer,
        meta: moveNodeMeta,
      },
    ],
    [
      "update-layout",
      {
        handler: updateLayoutHandler as RuntimeHandlerEntry["handler"],
        inverse: updateLayoutInverse as InverseComputer,
        meta: updateLayoutMeta,
      },
    ],
    [
      "rotate-node",
      {
        handler: rotateNodeHandler as RuntimeHandlerEntry["handler"],
        inverse: rotateNodeInverse as InverseComputer,
        meta: rotateNodeMeta,
      },
    ],
    [
      "update-props",
      {
        handler: updatePropsHandler as RuntimeHandlerEntry["handler"],
        inverse: updatePropsInverse as InverseComputer,
        meta: updatePropsMeta,
      },
    ],
    [
      "update-style",
      {
        handler: updateStyleHandler as RuntimeHandlerEntry["handler"],
        inverse: updateStyleInverse as InverseComputer,
        meta: updateStyleMeta,
      },
    ],
    [
      "update-bindings",
      {
        handler: updateBindingsHandler as RuntimeHandlerEntry["handler"],
        inverse: updateBindingsInverse as InverseComputer,
        meta: updateBindingsMeta,
      },
    ],
    [
      "update-runtime",
      {
        handler: updateRuntimeHandler as RuntimeHandlerEntry["handler"],
        inverse: updateRuntimeInverse as InverseComputer,
        meta: updateRuntimeMeta,
      },
    ],
    [
      "update-selection",
      {
        handler: updateSelectionHandler as RuntimeHandlerEntry["handler"],
        inverse: updateSelectionInverse as InverseComputer,
        meta: updateSelectionMeta,
      },
    ],
    [
      "batch-actions",
      {
        handler: createBatchHandler(
          _batchDispatch,
        ) as RuntimeHandlerEntry["handler"],
        inverse: batchInverse as InverseComputer,
        meta: batchMeta,
      },
    ],
  ];

  // Build registries with batch inverse stub
  const { handlerRegistry, inverseRegistry } =
    buildRegistriesFromEntries(entries);

  const rtInvRegistry = inverseRegistry as unknown as InverseRegistry;
  const rtHandlerRegistry =
    handlerRegistry as unknown as RuntimeHandlerRegistry;

  // Replace batch inverse with a proper one that has registry access
  const batchInv = createBatchInverse(rtHandlerRegistry, rtInvRegistry);
  const batchEntry = rtHandlerRegistry.get("batch-actions");
  if (batchEntry) {
    rtHandlerRegistry.set("batch-actions", {
      ...batchEntry,
      inverse: batchInv as InverseComputer,
    });
  }
  rtInvRegistry.set("batch-actions", batchInv as InverseComputer);

  return {
    handlerRegistry: handlerRegistry as Map<string, RuntimeHandlerEntry>,
    inverseRegistry: inverseRegistry as InverseRegistry,
  };
}
