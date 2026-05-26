import type { PersistedSceneGraph } from "../types.js";
import type { RuntimeAction } from "./actions.js";
import type { DispatchResult } from "./command-bus.js";
import type { EventLogEntry } from "../engine/event-log.js";
import { replayEvents } from "../engine/event-log.js";

export type RuntimeEventLogEntry = EventLogEntry<RuntimeAction>;

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

export function replayRuntimeEvents(
  log: RuntimeEventLog,
  dispatch: (action: RuntimeAction) => DispatchResult,
): void {
  replayEvents(log, dispatch, ["update-selection"]);
}
