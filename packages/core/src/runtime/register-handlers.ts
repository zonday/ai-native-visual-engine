import { ActionRegistry } from "../engine/action-registry.js";
import type { RuntimeAction } from "./actions.js";
import type { DispatchResult } from "./command-bus.js";
import {
  createNodeHandler,
  createNodeInverse,
} from "./handlers/create-node.js";
import {
  createBatchHandler,
} from "./handlers/batch.js";
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
import type {
  RuntimeHandlerEntry,
} from "./handler-registry.js";
import type { SceneGraph } from "../types.js";
import type { RuntimeContext } from "../engine/handler.js";

function entry(
  handler: RuntimeHandlerEntry["handler"],
  inverse: RuntimeHandlerEntry["inverse"],
) {
  return {
    handler,
    inverse,
    meta: { undoable: true, mergeable: false, devtoolsLabel: "" },
  };
}

export function createRuntimeRegistry(
  batchDispatch: (action: RuntimeAction) => DispatchResult,
): ActionRegistry<RuntimeAction, SceneGraph, RuntimeContext> {
  const registry = new ActionRegistry<RuntimeAction, SceneGraph, RuntimeContext>();

  // Type casts are required due to TypeScript contravariance.
  // See runtime/inverse.ts for the same pattern.
  registry.register("create-node", entry(
    createNodeHandler as RuntimeHandlerEntry["handler"],
    createNodeInverse as RuntimeHandlerEntry["inverse"],
  ));
  registry.register("remove-node", entry(
    removeNodeHandler as RuntimeHandlerEntry["handler"],
    removeNodeInverse as RuntimeHandlerEntry["inverse"],
  ));
  registry.register("move-node", entry(
    moveNodeHandler as RuntimeHandlerEntry["handler"],
    moveNodeInverse as RuntimeHandlerEntry["inverse"],
  ));
  registry.register("update-layout", entry(
    updateLayoutHandler as RuntimeHandlerEntry["handler"],
    updateLayoutInverse as RuntimeHandlerEntry["inverse"],
  ));
  registry.register("rotate-node", entry(
    rotateNodeHandler as RuntimeHandlerEntry["handler"],
    rotateNodeInverse as RuntimeHandlerEntry["inverse"],
  ));
  registry.register("update-props", entry(
    updatePropsHandler as RuntimeHandlerEntry["handler"],
    updatePropsInverse as RuntimeHandlerEntry["inverse"],
  ));
  registry.register("update-style", entry(
    updateStyleHandler as RuntimeHandlerEntry["handler"],
    updateStyleInverse as RuntimeHandlerEntry["inverse"],
  ));
  registry.register("update-bindings", entry(
    updateBindingsHandler as RuntimeHandlerEntry["handler"],
    updateBindingsInverse as RuntimeHandlerEntry["inverse"],
  ));
  registry.register("update-runtime", entry(
    updateRuntimeHandler as RuntimeHandlerEntry["handler"],
    updateRuntimeInverse as RuntimeHandlerEntry["inverse"],
  ));
  registry.register("update-selection", entry(
    updateSelectionHandler as RuntimeHandlerEntry["handler"],
    updateSelectionInverse as RuntimeHandlerEntry["inverse"],
  ));
  registry.register("batch-actions", entry(
    createBatchHandler(batchDispatch) as RuntimeHandlerEntry["handler"],
    (() => undefined) as RuntimeHandlerEntry["inverse"],
  ));

  return registry;
}
