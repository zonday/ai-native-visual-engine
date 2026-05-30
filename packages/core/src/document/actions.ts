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

export type { CreatePageAction } from "./handlers/create-page.js";
export type { RenamePageAction } from "./handlers/rename-page.js";
export type { RemovePageAction } from "./handlers/remove-page.js";
export type { ReorderPageAction } from "./handlers/reorder-page.js";
export type { UpdatePageRouteAction } from "./handlers/update-page-route.js";
export type { SetDocumentThemeAction } from "./handlers/set-document-theme.js";
export type { SetPageThemeAction } from "./handlers/set-page-theme.js";
export type { BatchDocumentActions } from "./handlers/batch.js";
export type DocumentAction = z.infer<typeof DocumentActionSchema>;
