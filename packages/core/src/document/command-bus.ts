import type { VisualDocument } from "../types.js";
import type { DocumentAction } from "./actions.js";
import type { EngineError } from "../engine/error.js";

export interface DocumentDispatchResult {
  ok: boolean;
  document: VisualDocument;
  error?: DocumentRuntimeError;
}

export interface DocumentRuntimeError extends EngineError {
  domain: "document";
  actionType?: string;
  pageId?: string;
}

export type DocumentCommandBus = {
  dispatch(action: DocumentAction): DocumentDispatchResult;
};
