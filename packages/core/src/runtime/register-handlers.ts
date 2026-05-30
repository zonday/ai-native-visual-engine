import { z } from "zod/v4";
import { ActionRegistry } from "../engine/action-registry.js";
import type { RuntimeContext } from "../engine/handler.js";
import type { SceneGraph } from "../types.js";
import { CreateNodeActionSchema } from "./handlers/create-node.js";
import { createNodeEntry } from "./handlers/create-node.js";
import { MoveNodeActionSchema } from "./handlers/move-node.js";
import { moveNodeEntry } from "./handlers/move-node.js";
import { RemoveNodeActionSchema } from "./handlers/remove-node.js";
import { removeNodeEntry } from "./handlers/remove-node.js";
import { RotateNodeActionSchema } from "./handlers/rotate-node.js";
import { rotateNodeEntry } from "./handlers/rotate-node.js";
import { UpdateBindingsActionSchema } from "./handlers/update-bindings.js";
import { updateBindingsEntry } from "./handlers/update-bindings.js";
import { UpdateLayoutActionSchema } from "./handlers/update-layout.js";
import { updateLayoutEntry } from "./handlers/update-layout.js";
import { UpdatePropsActionSchema } from "./handlers/update-props.js";
import { updatePropsEntry } from "./handlers/update-props.js";
import { UpdateRuntimeActionSchema } from "./handlers/update-runtime.js";
import { updateRuntimeEntry } from "./handlers/update-runtime.js";
import { UpdateSelectionActionSchema } from "./handlers/update-selection.js";
import { updateSelectionEntry } from "./handlers/update-selection.js";
import { UpdateStyleActionSchema } from "./handlers/update-style.js";
import { updateStyleEntry } from "./handlers/update-style.js";

export const BatchActionsSchema = z.object({
  type: z.literal("batch-actions"),
  actions: z.array(z.any()),
});

export const RuntimeActionSchema = z.discriminatedUnion("type", [
  CreateNodeActionSchema,
  RemoveNodeActionSchema,
  MoveNodeActionSchema,
  UpdateLayoutActionSchema,
  RotateNodeActionSchema,
  UpdatePropsActionSchema,
  UpdateStyleActionSchema,
  UpdateBindingsActionSchema,
  UpdateRuntimeActionSchema,
  UpdateSelectionActionSchema,
  BatchActionsSchema,
]);

export type RuntimeAction = z.infer<typeof RuntimeActionSchema>;
export type BatchActions = z.infer<typeof BatchActionsSchema>;

export function createRuntimeRegistry(): ActionRegistry<
  RuntimeAction,
  SceneGraph,
  RuntimeContext
> {
  const registry = new ActionRegistry<RuntimeAction, SceneGraph, RuntimeContext>();
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
