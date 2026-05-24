import type { VisualDocument } from "../types.js";
import type { DocumentAction } from "./actions.js";

export interface DocumentRuntimeError {
  code: string;
  message: string;
  actionType?: string;
  pageId?: string;
}

export interface DocumentDispatchResult {
  ok: boolean;
  document: VisualDocument;
  error?: DocumentRuntimeError;
}

export type DocumentCommandBus = {
  dispatch(action: DocumentAction): DocumentDispatchResult;
};
