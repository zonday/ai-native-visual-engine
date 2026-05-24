import type { VisualDocument } from "../types.js";
import type { DocumentAction } from "./actions.js";

/**
 * Generic history entry per spec §2.
 * Concrete domain types create aliases, e.g. DocumentHistoryEntry = HistoryEntry<DocumentAction>.
 */
export interface HistoryEntry<TAction> {
  action: TAction;
  inverseAction?: TAction;
  timestamp: number;
  actorId?: string;
}

export interface HistoryState<TAction> {
  undoStack: HistoryEntry<TAction>[];
  redoStack: HistoryEntry<TAction>[];
}

export type DocumentHistoryEntry = HistoryEntry<DocumentAction>;
export type DocumentHistoryState = HistoryState<DocumentAction>;

export function createDocumentHistoryState(): DocumentHistoryState {
  return { undoStack: [], redoStack: [] };
}

export const DEFAULT_MAX_DOCUMENT_UNDO_STACK = 200;

export function pushDocumentUndo(
  state: DocumentHistoryState,
  entry: DocumentHistoryEntry,
  maxStackSize: number = DEFAULT_MAX_DOCUMENT_UNDO_STACK,
): DocumentHistoryState {
  const undoStack = [...state.undoStack, entry];
  if (undoStack.length > maxStackSize) {
    undoStack.shift();
  }
  return { undoStack, redoStack: [] };
}

/**
 * Pops the top entry from the undo stack and returns the inverse action.
 * Note: this function does NOT apply the inverse to the document — it only
 * manages history stack state. The caller is responsible for dispatching
 * the returned inverseAction through the command bus. This design keeps
 * history pure (no mutation) and allows the command bus middleware to
 * handle dispatch.
 */
export function undoDocumentAction(
  state: DocumentHistoryState,
  document: VisualDocument,
  _context: { now: () => number },
): {
  state: DocumentHistoryState;
  document: VisualDocument;
  inverseAction?: DocumentAction;
} | null {
  if (state.undoStack.length === 0) return null;

  const entry = state.undoStack[state.undoStack.length - 1];
  if (!entry?.inverseAction) return null;

  return {
    state: {
      undoStack: state.undoStack.slice(0, -1),
      redoStack: [...state.redoStack, entry],
    },
    document,
    inverseAction: entry.inverseAction,
  };
}

export function redoDocumentAction(
  state: DocumentHistoryState,
): { state: DocumentHistoryState; action: DocumentAction } | null {
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
