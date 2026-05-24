import { batchInverse } from "./handlers/batch.js";
import { createPageInverse } from "./handlers/create-page.js";
import { removePageInverse } from "./handlers/remove-page.js";
import { renamePageInverse } from "./handlers/rename-page.js";
import { reorderPageInverse } from "./handlers/reorder-page.js";
import { setDocumentThemeInverse } from "./handlers/set-document-theme.js";
import { setPageThemeInverse } from "./handlers/set-page-theme.js";
import { updatePageRouteInverse } from "./handlers/update-page-route.js";
import type { InverseComputer } from "./inverse-registry.js";
import {
  createInverseRegistry,
  type InverseRegistry,
} from "./inverse-registry.js";

export type { InverseComputer, InverseRegistry } from "./inverse-registry.js";

export const defaultInverseRegistry: InverseRegistry = createInverseRegistry({
  "create-page": createPageInverse as InverseComputer,
  "rename-page": renamePageInverse as InverseComputer,
  "remove-page": removePageInverse as InverseComputer,
  "reorder-page": reorderPageInverse as InverseComputer,
  "update-page-route": updatePageRouteInverse as InverseComputer,
  "set-document-theme": setDocumentThemeInverse as InverseComputer,
  "set-page-theme": setPageThemeInverse as InverseComputer,
  "batch-document-actions": batchInverse as InverseComputer,
});
