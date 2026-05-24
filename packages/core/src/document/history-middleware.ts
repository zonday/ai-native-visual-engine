import { createUndoHistoryMiddleware as createEngineUndoHistoryMiddleware } from "../engine/history-middleware.js";
import type { DocumentAction } from "./actions.js";
import type { DocumentRuntimeContext } from "./handler.js";
import type { DocumentHandlerRegistry } from "./handler-registry.js";
import type { HistoryState } from "./history.js";
import type { DocumentMiddleware } from "./middleware.js";

export function createUndoHistoryMiddleware(
  getHistory: () => HistoryState,
  setHistory: (state: HistoryState) => void,
  getActorId: () => string | undefined,
  registry: DocumentHandlerRegistry,
  getContext: () => DocumentRuntimeContext,
): DocumentMiddleware {
  return createEngineUndoHistoryMiddleware(
    getHistory,
    setHistory,
    getActorId,
    registry,
    getContext,
  );
}
