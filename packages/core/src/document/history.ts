import type { HistoryState } from "../engine/history.js";
import {
  createHistoryState,
  DEFAULT_MAX_UNDO_STACK,
  pushUndo,
  pushUndoTransaction,
  redoAction,
  undoAction,
} from "../engine/history.js";
import type { DocumentAction } from "./actions.js";

export type DocumentHistoryState = HistoryState<DocumentAction>;

export const DEFAULT_MAX_DOCUMENT_UNDO_STACK = DEFAULT_MAX_UNDO_STACK;
export const createDocumentHistoryState = createHistoryState<DocumentAction>;
export const pushDocumentUndo = pushUndo<DocumentAction>;
export const pushDocumentUndoTransaction = pushUndoTransaction<DocumentAction>;
export const undoDocumentAction = undoAction<DocumentAction>;
export const redoDocumentAction = redoAction<DocumentAction>;
