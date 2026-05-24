import type { DocumentAction } from "./actions.js";
import type { DocumentHandler } from "./handler.js";
import type { InverseComputer } from "./inverse-registry.js";

export interface DocumentHandlerEntry {
  handler: DocumentHandler<DocumentAction>;
  inverse: InverseComputer;
}

export type DocumentHandlerRegistry = Map<string, DocumentHandlerEntry>;
