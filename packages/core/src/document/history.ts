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
import type { DocumentAction } from "./actions.js";

export type HistoryEntry<T = DocumentAction> = EngineHistoryEntry<T>;
export type HistoryState<T = DocumentAction> = EngineHistoryState<T>;
export type DocumentHistoryEntry = HistoryEntry;
export type DocumentHistoryState = HistoryState;

export const DEFAULT_MAX_DOCUMENT_UNDO_STACK = DEFAULT_MAX_UNDO_STACK;

export const createDocumentHistoryState = createHistoryState<DocumentAction>;
export const pushDocumentUndo = pushUndo<DocumentAction>;

export function undoDocumentAction(
  state: DocumentHistoryState,
): { state: DocumentHistoryState; inverseAction: DocumentAction } | null {
  return undoAction(state);
}

export function redoDocumentAction(
  state: DocumentHistoryState,
): { state: DocumentHistoryState; action: DocumentAction } | null {
  return redoAction(state);
}
