import type { ActionRegistry, HandlerMap } from "../engine/action-registry.js";
import type { Handler, RuntimeContext } from "../engine/handler.js";
import type { HandlerEntry } from "../engine/handler-registry.js";
import type { VisualDocument } from "../types.js";
import type { DocumentAction } from "./register-handlers.js";

export interface DocumentRuntimeContext extends RuntimeContext {}

export type { ActionRegistry, HandlerMap, RuntimeContext };

export type DocumentHandler<TAction extends DocumentAction = DocumentAction> =
  Handler<VisualDocument, TAction, DocumentRuntimeContext>;

export type DocumentHandlerEntry = HandlerEntry<
  VisualDocument,
  DocumentAction,
  DocumentRuntimeContext
>;

export type InverseComputer<TAction extends DocumentAction = DocumentAction> = (
  documentBefore: VisualDocument,
  action: TAction,
  context: DocumentRuntimeContext,
) => DocumentAction | undefined;
