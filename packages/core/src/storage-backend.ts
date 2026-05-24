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

export class InMemoryStorageBackend implements StorageBackend {
  private documents = new Map<string, DocumentSnapshot>();
  private eventLogs = new Map<
    string,
    DocumentAction[] | RuntimeAction[]
  >();

  async loadDocument(documentId: string): Promise<DocumentSnapshot | null> {
    return this.documents.get(documentId) ?? null;
  }

  async saveDocument(snapshot: DocumentSnapshot): Promise<void> {
    this.documents.set(snapshot.document.id, snapshot);
  }

  async appendEventLog(
    context: string,
    contextId: string,
    actions: DocumentAction[] | RuntimeAction[],
  ): Promise<void> {
    const key = `${context}:${contextId}`;
    const existing = this.eventLogs.get(key);
    if (existing) {
      (existing as Array<DocumentAction | RuntimeAction>).push(...actions);
    } else {
      this.eventLogs.set(key, actions);
    }
  }

  async loadEventLog(
    context: string,
    contextId: string,
    _sinceVersion?: number,
  ): Promise<DocumentAction[] | RuntimeAction[]> {
    const key = `${context}:${contextId}`;
    return this.eventLogs.get(key) ?? [];
  }

  async compact(_documentId: string): Promise<void> {
    // No-op in memory: snapshots and event logs are always in memory
  }
}
