import { ActionRegistry } from "../engine/action-registry.js";
import type { RuntimeContext } from "../engine/handler.js";
import type { SceneGraph } from "../types.js";
import type { RuntimeAction } from "./actions.js";
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

export function createRuntimeRegistry(): ActionRegistry<
  RuntimeAction,
  SceneGraph,
  RuntimeContext
> {
  const registry = new ActionRegistry<
    RuntimeAction,
    SceneGraph,
    RuntimeContext
  >();
  registry.register("create-node", createNodeEntry);
  registry.register("remove-node", removeNodeEntry);
  registry.register("move-node", moveNodeEntry);
  registry.register("update-layout", updateLayoutEntry);
  registry.register("rotate-node", rotateNodeEntry);
  registry.register("update-props", updatePropsEntry);
  registry.register("update-style", updateStyleEntry);
  registry.register("update-bindings", updateBindingsEntry);
  registry.register("update-runtime", updateRuntimeEntry);
  registry.register("update-selection", updateSelectionEntry);
  registry.register("batch-actions", registry.createBatchEntry());
  return registry;
}
