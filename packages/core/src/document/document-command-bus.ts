import type { VisualDocument } from "../types.js";
import type { DocumentAction } from "./actions.js";
import type { DocumentDispatchResult } from "./command-bus.js";
import { DocumentHandlerError } from "./error.js";
import type { DocumentRuntimeContext } from "./handler.js";
import type { DocumentHandlerRegistry } from "./handler-registry.js";
import type { DocumentMiddleware } from "./middleware.js";
import { createCommandBus } from "../engine/command-bus.js";

export function createDocumentCommandBus(
  registry: DocumentHandlerRegistry,
  middlewares: DocumentMiddleware[],
  initialState: VisualDocument,
  context: DocumentRuntimeContext,
) {
  const bus = createCommandBus(registry, middlewares, initialState, context);
  return {
    dispatch(action: DocumentAction): DocumentDispatchResult {
      try {
        const result = bus.dispatch(action);
        return {
          ok: result.ok,
          document: result.state,
          error: result.error,
        };
      } catch (err) {
        if (err instanceof DocumentHandlerError) {
          return {
            ok: false,
            document: bus.getState(),
            error: {
              code: err.code,
              message: err.message,
              actionType: err.actionType ?? action.type,
              pageId: err.pageId,
            },
          };
        }
        return {
          ok: false,
          document: bus.getState(),
          error: {
            code: "document.handler-error",
            message: err instanceof Error ? err.message : "Unknown error",
            actionType: action.type,
          },
        };
      }
    },
    getDocument(): VisualDocument {
      return bus.getState();
    },
  };
}
