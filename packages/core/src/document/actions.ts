import { z } from "zod/v4";
import { PageSchema, PersistedSceneGraphSchema } from "../types.js";

export const CreatePageActionSchema = z.object({
  type: z.literal("create-page"),
  page: PageSchema,
  scene: PersistedSceneGraphSchema,
});

export const RenamePageActionSchema = z.object({
  type: z.literal("rename-page"),
  pageId: z.string(),
  name: z.string(),
});

export const RemovePageActionSchema = z.object({
  type: z.literal("remove-page"),
  pageId: z.string(),
});

export const ReorderPageActionSchema = z.object({
  type: z.literal("reorder-page"),
  pageId: z.string(),
  index: z.number().int().min(0),
});

export const UpdatePageRouteActionSchema = z.object({
  type: z.literal("update-page-route"),
  pageId: z.string(),
  route: z.string(),
});

export const SetDocumentThemeActionSchema = z.object({
  type: z.literal("set-document-theme"),
  themeId: z.string().optional(),
});

export const SetPageThemeActionSchema = z.object({
  type: z.literal("set-page-theme"),
  pageId: z.string(),
  themeId: z.string().optional(),
});

export const BatchDocumentActionsSchema = z.object({
  type: z.literal("batch-document-actions"),
  actions: z.array(z.unknown()),
});

export const DocumentActionSchema = z.discriminatedUnion("type", [
  CreatePageActionSchema,
  RenamePageActionSchema,
  RemovePageActionSchema,
  ReorderPageActionSchema,
  UpdatePageRouteActionSchema,
  SetDocumentThemeActionSchema,
  SetPageThemeActionSchema,
  BatchDocumentActionsSchema,
]);

export type CreatePageAction = z.infer<typeof CreatePageActionSchema>;
export type RenamePageAction = z.infer<typeof RenamePageActionSchema>;
export type RemovePageAction = z.infer<typeof RemovePageActionSchema>;
export type ReorderPageAction = z.infer<typeof ReorderPageActionSchema>;
export type UpdatePageRouteAction = z.infer<typeof UpdatePageRouteActionSchema>;
export type SetDocumentThemeAction = z.infer<
  typeof SetDocumentThemeActionSchema
>;
export type SetPageThemeAction = z.infer<typeof SetPageThemeActionSchema>;
export type BatchDocumentActions = z.infer<typeof BatchDocumentActionsSchema>;
export type DocumentAction = z.infer<typeof DocumentActionSchema>;
