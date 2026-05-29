import { z } from "zod/v4";
import { SceneNodeSchema } from "../types.js";

export const CreateNodeActionSchema = z.object({
  type: z.literal("create-node"),
  node: SceneNodeSchema,
  parentId: z.string(),
  index: z.number().optional(),
});

export const RemoveNodeActionSchema = z.object({
  type: z.literal("remove-node"),
  nodeId: z.string(),
});

export const MoveNodeActionSchema = z.object({
  type: z.literal("move-node"),
  nodeId: z.string(),
  parentId: z.string(),
  index: z.number().optional(),
});

export const UpdateLayoutActionSchema = z.object({
  type: z.literal("update-layout"),
  nodeId: z.string(),
  layout: z.object({}).passthrough(),
});

export const RotateNodeActionSchema = z.object({
  type: z.literal("rotate-node"),
  nodeId: z.string(),
  rotation: z.number(),
});

export const UpdatePropsActionSchema = z.object({
  type: z.literal("update-props"),
  nodeId: z.string(),
  props: z.object({}).passthrough(),
});

export const UpdateStyleActionSchema = z.object({
  type: z.literal("update-style"),
  nodeId: z.string(),
  style: z.object({}).passthrough(),
});

export const UpdateBindingsActionSchema = z.object({
  type: z.literal("update-bindings"),
  nodeId: z.string(),
  bindings: z.array(
    z.object({
      key: z.string(),
      source: z.string(),
      path: z.string().optional(),
      transform: z.string().optional(),
    }),
  ),
});

export const UpdateRuntimeActionSchema = z.object({
  type: z.literal("update-runtime"),
  nodeId: z.string(),
  runtime: z.object({}).passthrough(),
});

export const UpdateSelectionActionSchema = z.object({
  type: z.literal("update-selection"),
  nodeIds: z.array(z.string()),
});

export const BatchActionsSchema = z.object({
  type: z.literal("batch-actions"),
  // z.any() is required here because RuntimeActionSchema includes
  // BatchActionsSchema itself, creating a circular Zod dependency.
  // Batch actions may contain nested batch actions (e.g. inverse rollup).
  actions: z.array(z.any()),
});

const runtimeActionSchemas = [
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
] as const;

export const RuntimeActionSchema = z.discriminatedUnion("type", [
  ...runtimeActionSchemas,
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
