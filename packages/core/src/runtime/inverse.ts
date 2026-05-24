import type { RuntimeAction } from "./actions.js";
import type { DispatchResult } from "./command-bus.js";
import type { RuntimeHandlerEntry } from "./handler-registry.js";
import { batchInverse, createBatchHandler } from "./handlers/batch.js";
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
import type { InverseComputer, InverseRegistry } from "./inverse-registry.js";
import { createInverseRegistry } from "./inverse-registry.js";

export type { InverseComputer, InverseRegistry } from "./inverse-registry.js";
export {
  computeInverseAction,
  createInverseRegistry,
} from "./inverse-registry.js";

export function createDefaultRuntimeRegistries(
  batchDispatch: (action: RuntimeAction) => DispatchResult,
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
      },
    ],
    [
      "remove-node",
      {
        handler: removeNodeHandler as RuntimeHandlerEntry["handler"],
        inverse: removeNodeInverse as InverseComputer,
      },
    ],
    [
      "move-node",
      {
        handler: moveNodeHandler as RuntimeHandlerEntry["handler"],
        inverse: moveNodeInverse as InverseComputer,
      },
    ],
    [
      "update-layout",
      {
        handler: updateLayoutHandler as RuntimeHandlerEntry["handler"],
        inverse: updateLayoutInverse as InverseComputer,
      },
    ],
    [
      "rotate-node",
      {
        handler: rotateNodeHandler as RuntimeHandlerEntry["handler"],
        inverse: rotateNodeInverse as InverseComputer,
      },
    ],
    [
      "update-props",
      {
        handler: updatePropsHandler as RuntimeHandlerEntry["handler"],
        inverse: updatePropsInverse as InverseComputer,
      },
    ],
    [
      "update-style",
      {
        handler: updateStyleHandler as RuntimeHandlerEntry["handler"],
        inverse: updateStyleInverse as InverseComputer,
      },
    ],
    [
      "update-bindings",
      {
        handler: updateBindingsHandler as RuntimeHandlerEntry["handler"],
        inverse: updateBindingsInverse as InverseComputer,
      },
    ],
    [
      "update-runtime",
      {
        handler: updateRuntimeHandler as RuntimeHandlerEntry["handler"],
        inverse: updateRuntimeInverse as InverseComputer,
      },
    ],
    [
      "update-selection",
      {
        handler: updateSelectionHandler as RuntimeHandlerEntry["handler"],
        inverse: updateSelectionInverse as InverseComputer,
      },
    ],
    [
      "batch-actions",
      {
        handler: createBatchHandler(
          batchDispatch,
        ) as RuntimeHandlerEntry["handler"],
        inverse: batchInverse as InverseComputer,
      },
    ],
  ];

  const handlerRegistry = new Map<string, RuntimeHandlerEntry>(entries);

  const inverseRegistry = createInverseRegistry(
    Object.fromEntries(entries.map(([key, entry]) => [key, entry.inverse])),
  );

  return { handlerRegistry, inverseRegistry };
}
