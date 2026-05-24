import type { VisualDocument } from "../types.js";
import type { DocumentAction } from "./actions.js";
import type { DocumentDispatchResult } from "./command-bus.js";
import { DocumentHandlerError } from "./error.js";
import type { DocumentRuntimeContext } from "./handler.js";
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
      const entry = registry.get(action.type);
      if (!entry) {
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

      const handler = entry.handler;
      let currentDocument = document;
      const chain = [...middlewares];

      function runChain(): DocumentDispatchResult {
        if (chain.length === 0) {
          currentDocument = handler(currentDocument, action, context);
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
        if (err instanceof DocumentHandlerError) {
          return {
            ok: false,
            document: currentDocument,
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
