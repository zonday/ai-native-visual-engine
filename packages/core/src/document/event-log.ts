import type { EventLogEntry } from "../engine/event-log.js";
import type { VisualDocument } from "../types.js";
import type { DocumentAction } from "./actions.js";

export type DocumentEventLogEntry = EventLogEntry<DocumentAction>;

export interface DocumentEventLog {
  initialDocument: VisualDocument;
  actions: DocumentEventLogEntry[];
}

export function createDocumentEventLog(
  initialDocument: VisualDocument,
): DocumentEventLog {
  return { initialDocument, actions: [] };
}

export function appendDocumentEvent(
  log: DocumentEventLog,
  entry: DocumentEventLogEntry,
): DocumentEventLog {
  return { ...log, actions: [...log.actions, entry] };
}
