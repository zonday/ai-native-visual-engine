import type { Handler, RuntimeContext } from "../engine/handler.js";
import type { VisualDocument } from "../types.js";
import type { DocumentAction } from "./actions.js";

export interface DocumentRuntimeContext extends RuntimeContext {}

export type DocumentHandler<TAction extends DocumentAction = DocumentAction> =
  Handler<VisualDocument, TAction, DocumentRuntimeContext>;
