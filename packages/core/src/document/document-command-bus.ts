import type { VisualDocument } from "../types.js";
import type { DocumentAction } from "./actions.js";
import type { DocumentDispatchResult } from "./command-bus.js";
import { DocumentHandlerError } from "./error.js";
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
      const handlerEntry = registry.get(action.type);
      if (!handlerEntry) {
        return {
          ok: false,
          document,
          error: {
            code: "document.unknown-action-type",
            message: `Unknown document action type: ${(action as DocumentAction).type}`,
            actionType: (action as DocumentAction).type,
          },
        };
      }

      const handler: DocumentHandler<DocumentAction> = handlerEntry;
      let currentDocument = document;
      const chain = [...middlewares];

      function runChain(): DocumentDispatchResult {
        if (chain.length === 0) {
          currentDocument = handler(
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
        return mw(action as DocumentAction, currentDocument, runChain);
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
              actionType: err.actionType ?? (action as DocumentAction).type,
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
            actionType: (action as DocumentAction).type,
          },
        };
      }
    },
    getDocument(): VisualDocument {
      return document;
    },
  };
}
