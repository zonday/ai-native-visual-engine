import type {
  HistoryEntry as EngineHistoryEntry,
  HistoryState as EngineHistoryState,
} from "../engine/history.js";
import {
  createHistoryState,
  DEFAULT_MAX_UNDO_STACK,
  pushUndo,
  redoAction,
  undoAction,
} from "../engine/history.js";
import type { RuntimeAction } from "./actions.js";

export type HistoryEntry<T = RuntimeAction> = EngineHistoryEntry<T>;
export type HistoryState<T = RuntimeAction> = EngineHistoryState<T>;
export type RuntimeHistoryEntry = HistoryEntry;
export type RuntimeHistoryState = HistoryState;

export const DEFAULT_MAX_RUNTIME_UNDO_STACK = DEFAULT_MAX_UNDO_STACK;

export const createRuntimeHistoryState = createHistoryState<RuntimeAction>;
export const pushRuntimeUndo = pushUndo<RuntimeAction>;

export function undoRuntimeAction(
  state: RuntimeHistoryState,
): { state: RuntimeHistoryState; inverseAction: RuntimeAction } | null {
  return undoAction(state);
}

export function redoRuntimeAction(
  state: RuntimeHistoryState,
): { state: RuntimeHistoryState; action: RuntimeAction } | null {
  return redoAction(state);
}
