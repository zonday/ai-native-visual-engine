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
  batchEntry,
  createBatchHandler,
  createBatchInverse,
} from "./handlers/batch.js";
import { createNodeEntry } from "./handlers/create-node.js";
import { moveNodeEntry } from "./handlers/move-node.js";
import { removeNodeEntry } from "./handlers/remove-node.js";
import { rotateNodeEntry } from "./handlers/rotate-node.js";
import { updateBindingsEntry } from "./handlers/update-bindings.js";
import { updateLayoutEntry } from "./handlers/update-layout.js";
import { updatePropsEntry } from "./handlers/update-props.js";
import { updateRuntimeEntry } from "./handlers/update-runtime.js";
import { updateSelectionEntry } from "./handlers/update-selection.js";
import { updateStyleEntry } from "./handlers/update-style.js";

export function createDefaultRuntimeRegistries(
  _batchDispatch: (action: RuntimeAction) => DispatchResult,
): {
  handlerRegistry: Map<string, RuntimeHandlerEntry>;
  inverseRegistry: InverseRegistry;
} {
  const entries: [string, RuntimeHandlerEntry][] = [
    ["create-node", createNodeEntry as RuntimeHandlerEntry],
    ["remove-node", removeNodeEntry as RuntimeHandlerEntry],
    ["move-node", moveNodeEntry as RuntimeHandlerEntry],
    ["update-layout", updateLayoutEntry as RuntimeHandlerEntry],
    ["rotate-node", rotateNodeEntry as RuntimeHandlerEntry],
    ["update-props", updatePropsEntry as RuntimeHandlerEntry],
    ["update-style", updateStyleEntry as RuntimeHandlerEntry],
    ["update-bindings", updateBindingsEntry as RuntimeHandlerEntry],
    ["update-runtime", updateRuntimeEntry as RuntimeHandlerEntry],
    ["update-selection", updateSelectionEntry as RuntimeHandlerEntry],
    [
      "batch-actions",
      {
        handler: createBatchHandler(
          _batchDispatch,
        ) as RuntimeHandlerEntry["handler"],
        inverse: batchEntry.inverse as InverseComputer,
        meta: { ...batchEntry.meta },
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
  const storedBatchEntry = rtHandlerRegistry.get("batch-actions");
  if (storedBatchEntry) {
    rtHandlerRegistry.set("batch-actions", {
      ...storedBatchEntry,
      inverse: batchInv as InverseComputer,
    });
  }
  rtInvRegistry.set("batch-actions", batchInv as InverseComputer);

  return {
    handlerRegistry: handlerRegistry as Map<string, RuntimeHandlerEntry>,
    inverseRegistry: inverseRegistry as InverseRegistry,
  };
}
