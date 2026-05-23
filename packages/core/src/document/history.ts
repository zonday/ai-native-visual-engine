import type { VisualDocument } from "../types.js";
import type { DocumentAction } from "./actions.js";

export interface DocumentHistoryEntry {
  action: DocumentAction;
  inverseAction?: DocumentAction;
  timestamp: number;
  actorId?: string;
}

export interface DocumentHistoryState {
  undoStack: DocumentHistoryEntry[];
  redoStack: DocumentHistoryEntry[];
}

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

  const cleanDocument =
    entry.inverseAction.type === "remove-page" ? document : document;

  return {
    state: {
      undoStack: state.undoStack.slice(0, -1),
      redoStack: [...state.redoStack, entry],
    },
    document: cleanDocument,
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
