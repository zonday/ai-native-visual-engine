import { z } from "zod/v4";

import { CreateNodeActionSchema } from "./handlers/create-node.js";
import { RemoveNodeActionSchema } from "./handlers/remove-node.js";
import { MoveNodeActionSchema } from "./handlers/move-node.js";
import { UpdateLayoutActionSchema } from "./handlers/update-layout.js";
import { RotateNodeActionSchema } from "./handlers/rotate-node.js";
import { UpdatePropsActionSchema } from "./handlers/update-props.js";
import { UpdateStyleActionSchema } from "./handlers/update-style.js";
import { UpdateBindingsActionSchema } from "./handlers/update-bindings.js";
import { UpdateRuntimeActionSchema } from "./handlers/update-runtime.js";
import { UpdateSelectionActionSchema } from "./handlers/update-selection.js";

export const BatchActionsSchema = z.object({
  type: z.literal("batch-actions"),
  // z.any() is required here because RuntimeActionSchema includes
  // BatchActionsSchema itself, creating a circular Zod dependency.
  // Batch actions may contain nested batch actions (e.g. inverse rollup).
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

export type CreateNodeAction = z.infer<typeof CreateNodeActionSchema>;
export type RemoveNodeAction = z.infer<typeof RemoveNodeActionSchema>;
export type MoveNodeAction = z.infer<typeof MoveNodeActionSchema>;
export type UpdateLayoutAction = z.infer<typeof UpdateLayoutActionSchema>;
export type RotateNodeAction = z.infer<typeof RotateNodeActionSchema>;
export type UpdatePropsAction = z.infer<typeof UpdatePropsActionSchema>;
export type UpdateStyleAction = z.infer<typeof UpdateStyleActionSchema>;
export type UpdateBindingsAction = z.infer<typeof UpdateBindingsActionSchema>;
export type UpdateRuntimeAction = z.infer<typeof UpdateRuntimeActionSchema>;
export type UpdateSelectionAction = z.infer<typeof UpdateSelectionActionSchema>;
export type BatchActions = z.infer<typeof BatchActionsSchema>;
export type RuntimeAction = z.infer<typeof RuntimeActionSchema>;
