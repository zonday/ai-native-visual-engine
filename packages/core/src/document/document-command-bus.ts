import type { Middleware } from "../engine/command-bus.js";
import {
  createCommandBus,
  extractErrorField,
  wrapCommandBus,
} from "../engine/command-bus.js";
import type { VisualDocument } from "../types.js";
import type { DocumentAction } from "./actions.js";
import type { DocumentDispatchResult } from "./command-bus.js";
import type {
  DocumentHandlerRegistry,
  DocumentRuntimeContext,
} from "./handler-registry.js";

type DocumentMiddleware = Middleware<VisualDocument, DocumentAction>;

export function createDocumentCommandBus(
  registry: DocumentHandlerRegistry,
  middlewares: DocumentMiddleware[],
  document: VisualDocument,
  context: DocumentRuntimeContext,
) {
  const bus = createCommandBus(registry, middlewares, document, context);
  const adapted = wrapCommandBus(bus, (result): DocumentDispatchResult => {
    const error = result.error
      ? {
          code: result.error.code,
          message: result.error.message,
          actionType: result.error.actionType,
          pageId: extractErrorField(result.error, "pageId"),
        }
      : undefined;
    return { ok: result.ok, document: result.state, error };
  });
  return {
    dispatch: adapted.dispatch,
    getDocument(): VisualDocument {
      return adapted.getState();
    },
  };
}
