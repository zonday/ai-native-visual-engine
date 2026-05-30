import { ActionRegistry } from "../engine/action-registry.js";
import type { RuntimeContext } from "../engine/handler.js";
import type { SceneGraph } from "../types.js";
import type { RuntimeAction } from "./actions.js";
import type { DispatchResult } from "./command-bus.js";
import type { RuntimeHandlerEntry } from "./handler-registry.js";
import { batchEntry, createBatchHandler } from "./handlers/batch.js";
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

export function createRuntimeRegistry(
  batchDispatch: (action: RuntimeAction) => DispatchResult,
): ActionRegistry<RuntimeAction, SceneGraph, RuntimeContext> {
  const registry = new ActionRegistry<
    RuntimeAction,
    SceneGraph,
    RuntimeContext
  >();

  // Type casts are required due to TypeScript contravariance.
  // See runtime/inverse.ts for the same pattern.
  registry.register("create-node", createNodeEntry as RuntimeHandlerEntry);
  registry.register("remove-node", removeNodeEntry as RuntimeHandlerEntry);
  registry.register("move-node", moveNodeEntry as RuntimeHandlerEntry);
  registry.register("update-layout", updateLayoutEntry as RuntimeHandlerEntry);
  registry.register("rotate-node", rotateNodeEntry as RuntimeHandlerEntry);
  registry.register("update-props", updatePropsEntry as RuntimeHandlerEntry);
  registry.register("update-style", updateStyleEntry as RuntimeHandlerEntry);
  registry.register(
    "update-bindings",
    updateBindingsEntry as RuntimeHandlerEntry,
  );
  registry.register(
    "update-runtime",
    updateRuntimeEntry as RuntimeHandlerEntry,
  );
  registry.register(
    "update-selection",
    updateSelectionEntry as RuntimeHandlerEntry,
  );
  registry.register("batch-actions", {
    handler: createBatchHandler(
      batchDispatch,
    ) as RuntimeHandlerEntry["handler"],
    inverse: batchEntry.inverse as RuntimeHandlerEntry["inverse"],
    meta: { ...batchEntry.meta },
  });

  return registry;
}
