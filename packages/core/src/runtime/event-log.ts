import type { PersistedSceneGraph } from "../types.js";
import type { RuntimeAction } from "./actions.js";
import type { DispatchResult } from "./command-bus.js";

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

export function replayRuntimeEvents(
  log: RuntimeEventLog,
  dispatch: (action: RuntimeAction) => DispatchResult,
): void {
  for (const entry of log.actions) {
    if (entry.action.type === "update-selection") continue;
    const result = dispatch(entry.action);
    if (!result.ok) {
      throw new Error(
        `Replay failed at action ${entry.action.type}: ${result.error?.message}`,
      );
    }
  }
}
