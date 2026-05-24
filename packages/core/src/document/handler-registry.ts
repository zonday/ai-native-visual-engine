import type {
  HandlerEntry,
  HandlerRegistry,
  InverseComputer,
} from "../engine/handler-registry.js";
import type { VisualDocument } from "../types.js";
import type { DocumentAction } from "./actions.js";
import type { DocumentRuntimeContext } from "./handler.js";

export type DocumentHandlerEntry = HandlerEntry<
  VisualDocument,
  DocumentAction,
  DocumentRuntimeContext
>;

export type DocumentHandlerRegistry = HandlerRegistry<
  VisualDocument,
  DocumentAction,
  DocumentRuntimeContext
>;

export type { InverseComputer };
