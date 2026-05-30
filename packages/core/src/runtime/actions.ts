import { z } from "zod/v4";

import { CreateNodeActionSchema } from "./handlers/create-node.js";
import { MoveNodeActionSchema } from "./handlers/move-node.js";
import { RemoveNodeActionSchema } from "./handlers/remove-node.js";
import { RotateNodeActionSchema } from "./handlers/rotate-node.js";
import { UpdateBindingsActionSchema } from "./handlers/update-bindings.js";
import { UpdateLayoutActionSchema } from "./handlers/update-layout.js";
import { UpdatePropsActionSchema } from "./handlers/update-props.js";
import { UpdateRuntimeActionSchema } from "./handlers/update-runtime.js";
import { UpdateSelectionActionSchema } from "./handlers/update-selection.js";
import { UpdateStyleActionSchema } from "./handlers/update-style.js";

export const BatchActionsSchema = z.object({
  type: z.literal("batch-actions"),
  // z.any() is required because RuntimeActionSchema includes BatchActionsSchema itself.
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

export type { BatchActions } from "./handlers/batch.js";
export type { CreateNodeAction } from "./handlers/create-node.js";
export type { MoveNodeAction } from "./handlers/move-node.js";
export type { RemoveNodeAction } from "./handlers/remove-node.js";
export type { RotateNodeAction } from "./handlers/rotate-node.js";
export type { UpdateBindingsAction } from "./handlers/update-bindings.js";
export type { UpdateLayoutAction } from "./handlers/update-layout.js";
export type { UpdatePropsAction } from "./handlers/update-props.js";
export type { UpdateRuntimeAction } from "./handlers/update-runtime.js";
export type { UpdateSelectionAction } from "./handlers/update-selection.js";
export type { UpdateStyleAction } from "./handlers/update-style.js";
export type RuntimeAction = z.infer<typeof RuntimeActionSchema>;
