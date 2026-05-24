import type { DocumentSnapshot } from "./types.js";
import type { DocumentEventLog } from "./document/event-log.js";
import type { RuntimeEventLog } from "./runtime/event-log.js";

export const DEFAULT_SNAPSHOT_INTERVAL = 100;
export const MAX_DOCUMENT_EVENT_LOG_ACTIONS = 1000;
export const MAX_SCENE_EVENT_LOG_ACTIONS = 500;

export interface SnapshotVerification {
  snapshot: DocumentSnapshot;
  logActions: number;
  logMatchesReplay: boolean;
}

export interface SnapshotManager {
  getSnapshot(): DocumentSnapshot;
  getDocumentEventLog(): DocumentEventLog;
  shouldCompact(): boolean;
  compact(replay: (snapshot: DocumentSnapshot, actions: DocumentEventLog) => DocumentSnapshot): DocumentSnapshot;
}

export function createSnapshotManager(
  snapshot: DocumentSnapshot,
  documentEventLog: DocumentEventLog,
  interval = DEFAULT_SNAPSHOT_INTERVAL,
): SnapshotManager {
  return {
    getSnapshot: () => snapshot,
    getDocumentEventLog: () => documentEventLog,
    shouldCompact(): boolean {
      return documentEventLog.actions.length >= interval;
    },
    compact(replay): DocumentSnapshot {
      return replay(snapshot, documentEventLog);
    },
  };
}

export function truncateDocumentEventLog(
  log: DocumentEventLog,
  sinceIndex: number,
): DocumentEventLog {
  return {
    ...log,
    actions: log.actions.filter((_entry, index) => index >= sinceIndex),
  };
}

export function truncateRuntimeEventLog(
  log: RuntimeEventLog,
  sinceIndex: number,
): RuntimeEventLog {
  return {
    ...log,
    actions: log.actions.filter((_entry, index) => index >= sinceIndex),
  };
}
