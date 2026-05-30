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
} from "./handlers/batch.js";
import {
  createNodeHandler,
  createNodeInverse,
} from "./handlers/create-node.js";
import { moveNodeHandler, moveNodeInverse } from "./handlers/move-node.js";
import {
  removeNodeHandler,
  removeNodeInverse,
} from "./handlers/remove-node.js";
import {
  rotateNodeHandler,
  rotateNodeInverse,
} from "./handlers/rotate-node.js";
import {
  updateBindingsHandler,
  updateBindingsInverse,
} from "./handlers/update-bindings.js";
import {
  updateLayoutHandler,
  updateLayoutInverse,
} from "./handlers/update-layout.js";
import {
  updatePropsHandler,
  updatePropsInverse,
} from "./handlers/update-props.js";
import {
  updateRuntimeHandler,
  updateRuntimeInverse,
} from "./handlers/update-runtime.js";
import {
  updateSelectionHandler,
  updateSelectionInverse,
} from "./handlers/update-selection.js";
import {
  updateStyleHandler,
  updateStyleInverse,
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
        meta: { undoable: true, mergeable: false, devtoolsLabel: "" },
      },
    ],
    [
      "remove-node",
      {
        handler: removeNodeHandler as RuntimeHandlerEntry["handler"],
        inverse: removeNodeInverse as InverseComputer,
        meta: { undoable: true, mergeable: false, devtoolsLabel: "" },
      },
    ],
    [
      "move-node",
      {
        handler: moveNodeHandler as RuntimeHandlerEntry["handler"],
        inverse: moveNodeInverse as InverseComputer,
        meta: { undoable: true, mergeable: false, devtoolsLabel: "" },
      },
    ],
    [
      "update-layout",
      {
        handler: updateLayoutHandler as RuntimeHandlerEntry["handler"],
        inverse: updateLayoutInverse as InverseComputer,
        meta: { undoable: true, mergeable: false, devtoolsLabel: "" },
      },
    ],
    [
      "rotate-node",
      {
        handler: rotateNodeHandler as RuntimeHandlerEntry["handler"],
        inverse: rotateNodeInverse as InverseComputer,
        meta: { undoable: true, mergeable: false, devtoolsLabel: "" },
      },
    ],
    [
      "update-props",
      {
        handler: updatePropsHandler as RuntimeHandlerEntry["handler"],
        inverse: updatePropsInverse as InverseComputer,
        meta: { undoable: true, mergeable: false, devtoolsLabel: "" },
      },
    ],
    [
      "update-style",
      {
        handler: updateStyleHandler as RuntimeHandlerEntry["handler"],
        inverse: updateStyleInverse as InverseComputer,
        meta: { undoable: true, mergeable: false, devtoolsLabel: "" },
      },
    ],
    [
      "update-bindings",
      {
        handler: updateBindingsHandler as RuntimeHandlerEntry["handler"],
        inverse: updateBindingsInverse as InverseComputer,
        meta: { undoable: true, mergeable: false, devtoolsLabel: "" },
      },
    ],
    [
      "update-runtime",
      {
        handler: updateRuntimeHandler as RuntimeHandlerEntry["handler"],
        inverse: updateRuntimeInverse as InverseComputer,
        meta: { undoable: true, mergeable: false, devtoolsLabel: "" },
      },
    ],
    [
      "update-selection",
      {
        handler: updateSelectionHandler as RuntimeHandlerEntry["handler"],
        inverse: updateSelectionInverse as InverseComputer,
        meta: { undoable: true, mergeable: false, devtoolsLabel: "" },
      },
    ],
    [
      "batch-actions",
      {
        handler: createBatchHandler(
          _batchDispatch,
        ) as RuntimeHandlerEntry["handler"],
        inverse: batchInverse as InverseComputer,
        meta: { undoable: true, mergeable: false, devtoolsLabel: "" },
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
