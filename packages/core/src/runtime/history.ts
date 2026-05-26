import type { HistoryState } from "../engine/history.js";
import {
  createHistoryState,
  DEFAULT_MAX_UNDO_STACK,
  pushUndo,
  redoAction,
  undoAction,
} from "../engine/history.js";
import type { RuntimeAction } from "./actions.js";

export type RuntimeHistoryState = HistoryState<RuntimeAction>;

export const DEFAULT_MAX_RUNTIME_UNDO_STACK = DEFAULT_MAX_UNDO_STACK;
export const createRuntimeHistoryState = createHistoryState<RuntimeAction>;
export const pushRuntimeUndo = pushUndo<RuntimeAction>;
export const undoRuntimeAction = undoAction<RuntimeAction>;
export const redoRuntimeAction = redoAction<RuntimeAction>;
