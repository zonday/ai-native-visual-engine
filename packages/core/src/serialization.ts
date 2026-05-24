import type { DocumentSnapshot } from "./types.js";
import type { DocumentAction } from "./document/actions.js";
import type { RuntimeAction } from "./runtime/actions.js";

export const CURRENT_SERIALIZATION_VERSION = 1;

export interface SerializedDocument {
  version: number;
  type: "document-snapshot";
  timestamp: number;
  payload: DocumentSnapshot;
}

export interface SerializedEventLog {
  version: number;
  type: "event-log";
  context: "document" | "scene";
  contextId: string;
  checkpointHash: string;
  actions: DocumentAction[] | RuntimeAction[];
}

export function serializeDocument(snapshot: DocumentSnapshot): SerializedDocument {
  return {
    version: CURRENT_SERIALIZATION_VERSION,
    type: "document-snapshot",
    timestamp: Date.now(),
    payload: snapshot,
  };
}

export function serializeEventLog(
  context: "document" | "scene",
  contextId: string,
  checkpointHash: string,
  actions: DocumentAction[] | RuntimeAction[],
): SerializedEventLog {
  return {
    version: CURRENT_SERIALIZATION_VERSION,
    type: "event-log",
    context,
    contextId,
    checkpointHash,
    actions,
  };
}
