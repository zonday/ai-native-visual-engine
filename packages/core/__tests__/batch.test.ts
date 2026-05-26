import { describe, it, expect } from "vitest";
import type { VisualDocument } from "../src/types.js";
import type { DocumentAction } from "../src/document/actions.js";
import type { DocumentDispatchResult } from "../src/document/command-bus.js";
import type { DocumentRuntimeContext } from "../src/document/handler.js";
import type { DocumentHandlerEntry } from "../src/document/handler-registry.js";
import {
  createDefaultDocumentRegistries,
} from "../src/document/inverse.js";
import { DocumentHandlerError } from "../src/document/error.js";
import { computeInverseAction } from "../src/document/inverse-registry.js";
import { createBatchHandler } from "../src/document/handlers/batch.js";
import { emptyPersistedScene, emptyDoc } from "./helpers.js";

const docWithTwoPages: VisualDocument = {
  ...emptyDoc,
  pages: [
    { id: "p1", name: "Page 1", sceneId: "s1", route: "/dashboard" },
    { id: "p2", name: "Page 2", sceneId: "s2", route: "/settings" },
  ],
  scenes: {
    s1: emptyPersistedScene,
    s2: { ...emptyPersistedScene, rootId: "root-2", nodes: { "root-2": { id: "root-2", type: "container" } } },
  },
};

const context: DocumentRuntimeContext = { now: Date.now };

function makeStatefulDispatch(handlerRegistry: Map<string, DocumentHandlerEntry>, initialDoc: VisualDocument) {
  let currentDoc = initialDoc;
  return (child: DocumentAction): DocumentDispatchResult => {
    const handler = handlerRegistry.get(child.type);
    if (!handler) {
      return { ok: false, document: currentDoc, error: { code: "document.unknown-action-type", message: `Unknown: ${child.type}` } };
    }
    try {
      currentDoc = handler.handler(currentDoc, child, context);
      return { ok: true, document: currentDoc };
    } catch (e) {
      return {
        ok: false,
        document: currentDoc,
        error: {
          code: e instanceof DocumentHandlerError ? e.code : "document.handler-error",
          message: e instanceof Error ? e.message : "Unknown error",
        },
      };
    }
  };
}

describe("batch handler via createDefaultDocumentRegistries", () => {
  it("executes multiple actions in sequence and returns updated document", () => {
    const { handlerRegistry } = createDefaultDocumentRegistries(
      () => ({ ok: false, document: emptyDoc, error: { code: "document.handler-error", message: "should not be called" } }),
    );
    const dispatch = makeStatefulDispatch(handlerRegistry, docWithTwoPages);
    const batchHandler = createBatchHandler(dispatch);

    const action: DocumentAction = {
      type: "batch-document-actions",
      actions: [
        { type: "rename-page", pageId: "p1", name: "Renamed" },
        { type: "rename-page", pageId: "p2", name: "Also Renamed" },
      ],
    };

    const result = batchHandler(docWithTwoPages, action, context);
    expect(result.pages).toHaveLength(2);
    expect(result.pages[0]?.name).toBe("Renamed");
    expect(result.pages[1]?.name).toBe("Also Renamed");
  });

  it("rolls back to original document when a child action fails", () => {
    const { handlerRegistry } = createDefaultDocumentRegistries(
      () => ({ ok: false, document: emptyDoc, error: { code: "document.handler-error", message: "should not be called" } }),
    );
    const dispatch = makeStatefulDispatch(handlerRegistry, docWithTwoPages);
    let callCount = 0;
    const failOnSecondCall: typeof dispatch = (child) => {
      callCount++;
      if (callCount === 2) {
        return { ok: false, document: docWithTwoPages, error: { code: "document.page-not-found", message: "not found", actionType: "rename-page", pageId: "missing" } };
      }
      return dispatch(child);
    };
    const batchHandler = createBatchHandler(failOnSecondCall);

    const action: DocumentAction = {
      type: "batch-document-actions",
      actions: [
        { type: "rename-page", pageId: "p1", name: "Renamed" },
        { type: "rename-page", pageId: "missing", name: "Nope" },
      ],
    };

    const result = batchHandler(docWithTwoPages, action, context);
    expect(result).toBe(docWithTwoPages);
    expect(callCount).toBe(2);
  });

  it("rejects child action that fails schema validation", () => {
    const { handlerRegistry } = createDefaultDocumentRegistries(
      () => ({ ok: false, document: emptyDoc, error: { code: "document.handler-error", message: "should not be called" } }),
    );
    const handler = handlerRegistry.get("batch-document-actions")!.handler;

    const action: DocumentAction = {
      type: "batch-document-actions",
      actions: [
        { type: "reorder-page", pageId: "p1", index: "invalid" } as unknown as DocumentAction,
      ],
    };

    expect(() => handler(docWithTwoPages, action, context)).toThrow(DocumentHandlerError);
  });

  it("flattens nested batch actions", () => {
    const { handlerRegistry } = createDefaultDocumentRegistries(
      () => ({ ok: false, document: emptyDoc, error: { code: "document.handler-error", message: "should not be called" } }),
    );
    const dispatch = makeStatefulDispatch(handlerRegistry, docWithTwoPages);
    const batchHandler = createBatchHandler(dispatch);

    const action: DocumentAction = {
      type: "batch-document-actions",
      actions: [
        { type: "rename-page", pageId: "p1", name: "First" },
        {
          type: "batch-document-actions",
          actions: [
            { type: "rename-page", pageId: "p2", name: "Nested" },
          ],
        },
      ],
    };

    const result = batchHandler(docWithTwoPages, action, context);
    expect(result.pages[0]?.name).toBe("First");
    expect(result.pages[1]?.name).toBe("Nested");
  });

  it("handles empty actions list without error", () => {
    const { handlerRegistry } = createDefaultDocumentRegistries(
      () => ({ ok: false, document: emptyDoc, error: { code: "document.handler-error", message: "should not be called" } }),
    );
    const handler = handlerRegistry.get("batch-document-actions")!.handler;

    const action: DocumentAction = {
      type: "batch-document-actions",
      actions: [],
    };

    const result = handler(docWithTwoPages, action, context);
    expect(result).toBe(docWithTwoPages);
  });
});

describe("batch inverse", () => {
  it("batch inverse returns undefined at registry level (stub)", () => {
    const { inverseRegistry } = createDefaultDocumentRegistries(
      () => ({ ok: true, document: emptyDoc }),
    );

    const action: DocumentAction = {
      type: "batch-document-actions",
      actions: [
        { type: "rename-page", pageId: "p1", name: "New Name" },
      ],
    };

    const inverse = computeInverseAction(inverseRegistry, docWithTwoPages, action, context);
    expect(inverse).toBeUndefined();
  });
});
