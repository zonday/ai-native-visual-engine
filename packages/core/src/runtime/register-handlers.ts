import { z } from "zod/v4";
import { ActionRegistry } from "../engine/action-registry.js";
import type { RuntimeContext } from "../engine/handler.js";
import type { SceneGraph } from "../types.js";
import {
  CreateNodeActionSchema,
  createNodeEntry,
} from "./handlers/create-node.js";
import { MoveNodeActionSchema, moveNodeEntry } from "./handlers/move-node.js";
import {
  RemoveNodeActionSchema,
  removeNodeEntry,
} from "./handlers/remove-node.js";
import {
  RotateNodeActionSchema,
  rotateNodeEntry,
} from "./handlers/rotate-node.js";
import {
  UpdateBindingsActionSchema,
  updateBindingsEntry,
} from "./handlers/update-bindings.js";
import {
  UpdateLayoutActionSchema,
  updateLayoutEntry,
} from "./handlers/update-layout.js";
import {
  UpdatePropsActionSchema,
  updatePropsEntry,
} from "./handlers/update-props.js";
import {
  UpdateRuntimeActionSchema,
  updateRuntimeEntry,
} from "./handlers/update-runtime.js";
import {
  UpdateSelectionActionSchema,
  updateSelectionEntry,
} from "./handlers/update-selection.js";
import {
  UpdateStyleActionSchema,
  updateStyleEntry,
} from "./handlers/update-style.js";
import { BatchActionsSchema } from "./handlers/batch.js";

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
