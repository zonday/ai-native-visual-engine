import type { RuntimeAction } from "./actions.js";

export const DEFAULT_MAX_RUNTIME_UNDO_STACK = 200;

export interface HistoryEntry<TAction extends RuntimeAction = RuntimeAction> {
  action: TAction;
  inverseAction?: TAction;
  timestamp: number;
  actorId?: string;
}

export interface HistoryState<TAction extends RuntimeAction = RuntimeAction> {
  undoStack: HistoryEntry<TAction>[];
  redoStack: HistoryEntry<TAction>[];
}

export type RuntimeHistoryEntry = HistoryEntry<RuntimeAction>;
export type RuntimeHistoryState = HistoryState<RuntimeAction>;

export function createRuntimeHistoryState(): RuntimeHistoryState {
  return { undoStack: [], redoStack: [] };
}

export function pushRuntimeUndo(
  state: RuntimeHistoryState,
  entry: RuntimeHistoryEntry,
  maxStackSize = DEFAULT_MAX_RUNTIME_UNDO_STACK,
): RuntimeHistoryState {
  const undoStack = [...state.undoStack, entry];
  const trimmed =
    undoStack.length > maxStackSize
      ? undoStack.slice(undoStack.length - maxStackSize)
      : undoStack;
  return {
    undoStack: trimmed,
    redoStack: [],
  };
}

export function undoRuntimeAction(
  state: RuntimeHistoryState,
): { state: RuntimeHistoryState; inverseAction: RuntimeAction } | null {
  if (state.undoStack.length === 0) return null;

  const entry = state.undoStack[state.undoStack.length - 1];
  if (!entry) return null;
  if (!entry.inverseAction) return null;

  return {
    state: {
      undoStack: state.undoStack.slice(0, -1),
      redoStack: [...state.redoStack, entry],
    },
    inverseAction: entry.inverseAction,
  };
}

export function redoRuntimeAction(
  state: RuntimeHistoryState,
): { state: RuntimeHistoryState; action: RuntimeAction } | null {
  if (state.redoStack.length === 0) return null;

  const entry = state.redoStack[state.redoStack.length - 1];
  if (!entry) return null;

  return {
    state: {
      undoStack: [...state.undoStack, entry],
      redoStack: state.redoStack.slice(0, -1),
    },
    action: entry.action,
  };
}
