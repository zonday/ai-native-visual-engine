import type { VisualDocument } from "../types.js";
import type { DocumentAction } from "./actions.js";
import type { DocumentDispatchResult } from "./command-bus.js";
import type { DocumentHandler, DocumentRuntimeContext } from "./handler.js";
import type { DocumentHandlerRegistry } from "./handler-registry.js";
import type { DocumentMiddleware } from "./middleware.js";

export function createDocumentCommandBus(
  registry: DocumentHandlerRegistry,
  middlewares: DocumentMiddleware[],
  document: VisualDocument,
  context: DocumentRuntimeContext,
) {
  return {
    dispatch(action: DocumentAction): DocumentDispatchResult {
      const handler = registry.get(action.type) as
        | DocumentHandler<DocumentAction>
        | undefined;
      if (!handler) {
        return {
          ok: false,
          document,
          error: {
            code: "document.unknown-action-type",
            message: `Unknown document action type: ${action.type}`,
            actionType: action.type,
          },
        };
      }

      let currentDocument = document;
      const chain = [...middlewares];

      function runChain(): DocumentDispatchResult {
        if (chain.length === 0) {
          const h = handler;
          if (!h)
            return {
              ok: false,
              document: currentDocument,
              error: {
                code: "document.handler-error",
                message: "Handler not found",
              },
            };
          currentDocument = h(
            currentDocument,
            action as DocumentAction,
            context,
          );
          return { ok: true, document: currentDocument };
        }
        const mw = chain.shift();
        if (!mw)
          return {
            ok: false,
            document: currentDocument,
            error: {
              code: "document.middleware-error",
              message: "Middleware chain broken",
            },
          };
        return mw(action, currentDocument, runChain);
      }

      try {
        return runChain();
      } catch (err) {
        return {
          ok: false,
          document: currentDocument,
          error: {
            code: "document.handler-error",
            message: err instanceof Error ? err.message : "Unknown error",
            actionType: action.type,
          },
        };
      }
    },
    getDocument(): VisualDocument {
      return document;
    },
  };
}
