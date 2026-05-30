import { z } from "zod/v4";

import { CreatePageActionSchema } from "./handlers/create-page.js";
import { RemovePageActionSchema } from "./handlers/remove-page.js";
import { RenamePageActionSchema } from "./handlers/rename-page.js";
import { ReorderPageActionSchema } from "./handlers/reorder-page.js";
import { SetDocumentThemeActionSchema } from "./handlers/set-document-theme.js";
import { SetPageThemeActionSchema } from "./handlers/set-page-theme.js";
import { UpdatePageRouteActionSchema } from "./handlers/update-page-route.js";

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
