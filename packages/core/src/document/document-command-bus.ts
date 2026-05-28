import { createCommandBus } from "../engine/command-bus.js";
import { HandlerError } from "../engine/error.js";
import type { VisualDocument } from "../types.js";
import type { DocumentAction } from "./actions.js";
import type {
  DocumentDispatchResult,
  DocumentRuntimeError,
} from "./command-bus.js";
import type { DocumentRuntimeContext } from "./handler.js";
import type { DocumentHandlerRegistry } from "./handler-registry.js";
import type { Middleware } from "../engine/command-bus.js";

type DocumentMiddleware = Middleware<VisualDocument, DocumentAction>;

function toDocumentError(
  err: unknown,
  actionType: string,
): DocumentRuntimeError {
  if (err instanceof HandlerError) {
    const rawPageId = err.context.pageId;
    return {
      code: err.code,
      message: err.message,
      actionType: err.actionType ?? actionType,
      pageId: typeof rawPageId === "string" ? rawPageId : undefined,
    };
  }
  return {
    code: "document.handler-error",
    message: err instanceof Error ? err.message : String(err),
    actionType,
  };
}

export function createDocumentCommandBus(
  registry: DocumentHandlerRegistry,
  middlewares: DocumentMiddleware[],
  document: VisualDocument,
  context: DocumentRuntimeContext,
) {
  const bus = createCommandBus(registry, middlewares, document, context);
  return {
    dispatch(action: DocumentAction): DocumentDispatchResult {
      try {
        const result = bus.dispatch(action);
        return {
          ok: result.ok,
          document: result.state,
          error: result.error
            ? {
                code: result.error.code,
                message: result.error.message,
                actionType: result.error.actionType,
              }
            : undefined,
        };
      } catch (err) {
        return {
          ok: false,
          document: bus.getState(),
          error: toDocumentError(err, action.type),
        };
      }
    },
    getDocument(): VisualDocument {
      return bus.getState();
    },
  };
}
