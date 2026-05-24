import { deepFreeze, detectSameRef, isDev } from "../engine/command-bus.js";
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
  let currentDocument = document;
  return {
    dispatch(action: DocumentAction): DocumentDispatchResult {
      const entry = registry.get(action.type);
      if (!entry) {
        return {
          ok: false,
          document: currentDocument,
          error: {
            code: "document.unknown-action-type",
            message: `Unknown document action type: ${action.type}`,
            actionType: action.type,
          },
        };
      }

      const handler = entry.handler;
      let runningDocument = currentDocument;
      const chain = [...middlewares];

      function runChain(): DocumentDispatchResult {
        if (chain.length === 0) {
          if (isDev) {
            const docBefore = runningDocument;
            deepFreeze(runningDocument);
            runningDocument = handler(runningDocument, action, context);
            detectSameRef(docBefore, runningDocument, action);
          } else {
            runningDocument = handler(runningDocument, action, context);
          }
          return { ok: true, document: runningDocument };
        }
        const mw = chain.shift();
        if (!mw)
          return {
            ok: false,
            document: runningDocument,
            error: {
              code: "document.middleware-error",
              message: "Middleware chain broken",
            },
          };
        return mw(action, runningDocument, runChain);
      }

      try {
        const result = runChain();
        if (result.ok) {
          currentDocument = result.document;
        }
        return result;
      } catch (err) {
        if (err instanceof DocumentHandlerError) {
          return {
            ok: false,
            document: runningDocument,
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
          document: runningDocument,
          error: {
            code: "document.handler-error",
            message: err instanceof Error ? err.message : "Unknown error",
            actionType: action.type,
          },
        };
      }
    },
    getDocument(): VisualDocument {
      return currentDocument;
    },
  };
}
