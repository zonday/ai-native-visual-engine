import type { DocumentSnapshot, DocumentId } from "./types.js";
import type { DocumentAction } from "./document/actions.js";
import type { RuntimeAction } from "./runtime/actions.js";

export interface StorageBackend {
  loadDocument(documentId: DocumentId): Promise<DocumentSnapshot | null>;
  saveDocument(snapshot: DocumentSnapshot): Promise<void>;
  appendEventLog(
    context: "document" | "scene",
    contextId: string,
    actions: DocumentAction[] | RuntimeAction[],
  ): Promise<void>;
  loadEventLog(
    context: "document" | "scene",
    contextId: string,
    sinceVersion?: number,
  ): Promise<DocumentAction[] | RuntimeAction[]>;
  compact(documentId: DocumentId): Promise<void>;
}
