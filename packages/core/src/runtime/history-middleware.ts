import { createUndoHistoryMiddleware as createEngineUndoHistoryMiddleware } from "../engine/history-middleware.js";
import type { RuntimeAction } from "./actions.js";
import type { RuntimeContext } from "./handler.js";
import type { RuntimeHandlerRegistry } from "./handler-registry.js";
import type { HistoryState } from "./history.js";
import type { RuntimeMiddleware } from "./middleware.js";

export function createUndoHistoryMiddleware(
  getHistory: () => HistoryState,
  setHistory: (state: HistoryState) => void,
  getActorId: () => string | undefined,
  registry: RuntimeHandlerRegistry,
  getContext: () => RuntimeContext,
): RuntimeMiddleware {
  return createEngineUndoHistoryMiddleware(
    getHistory,
    setHistory,
    getActorId,
    registry,
    getContext,
  );
}
