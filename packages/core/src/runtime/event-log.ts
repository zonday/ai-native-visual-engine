import type { PersistedSceneGraph } from "../types.js";
import type { RuntimeAction } from "./actions.js";

export interface RuntimeEventLogEntry {
  action: RuntimeAction;
  actorId?: string;
  timestamp: number;
}

export interface RuntimeEventLog {
  initialScene: PersistedSceneGraph;
  actions: RuntimeEventLogEntry[];
}

export function createRuntimeEventLog(
  initialScene: PersistedSceneGraph,
): RuntimeEventLog {
  return { initialScene, actions: [] };
}

export function appendRuntimeEvent(
  log: RuntimeEventLog,
  entry: RuntimeEventLogEntry,
): RuntimeEventLog {
  return { ...log, actions: [...log.actions, entry] };
}
