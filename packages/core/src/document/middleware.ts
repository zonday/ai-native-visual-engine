import type { VisualDocument } from "../types.js";
import type { DocumentAction } from "./actions.js";
import type { DocumentDispatchResult } from "./command-bus.js";

export type DocumentMiddleware = (
  action: DocumentAction,
  document: VisualDocument,
  next: () => DocumentDispatchResult,
) => DocumentDispatchResult;
