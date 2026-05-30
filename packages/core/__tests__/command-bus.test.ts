import { describe, expect, it, vi } from "vitest";
import type { DocumentAction } from "../src/document/actions.js";
import { createDocumentCommandBus } from "../src/document/document-command-bus.js";
import type { DocumentRuntimeContext } from "../src/document/handler-registry.js";
import { createDocumentRegistry } from "../src/document/register-handlers.js";
import { ActionRegistry } from "../src/engine/action-registry.js";
import type { Middleware } from "../src/engine/command-bus.js";
import type { VisualDocument } from "../src/types.js";

type DocumentMiddleware = Middleware<VisualDocument, DocumentAction>;

import { emptyDoc, emptyPersistedScene } from "./helpers.js";

const docWithPage: VisualDocument = {
  ...emptyDoc,
  pages: [{ id: "p1", name: "Page 1", sceneId: "s1" }],
  scenes: { s1: emptyPersistedScene },
};

const context: DocumentRuntimeContext = { now: Date.now };

describe("createDocumentCommandBus", () => {
  it("dispatches a valid action and returns ok with updated document", () => {
    const docReg = createDocumentRegistry(() => ({
      ok: false,
      document: emptyDoc,
      error: {
        code: "document.handler-error",
        message: "should not be called",
      },
    }));
    const bus = createDocumentCommandBus(docReg, [], emptyDoc, context);

    const action: DocumentAction = {
      type: "create-page",
      page: { id: "p1", name: "Page 1", sceneId: "s1" },
      scene: emptyPersistedScene,
    };

    const result = bus.dispatch(action);
    expect(result.ok).toBe(true);
    expect(result.document.pages).toHaveLength(1);
    expect(result.document.pages[0]?.id).toBe("p1");
  });

  it("returns unknown-action-type error for unregistered action type", () => {
    const docReg = createDocumentRegistry(() => ({
      ok: false,
      document: emptyDoc,
      error: {
        code: "document.handler-error",
        message: "should not be called",
      },
    }));
    const bus = createDocumentCommandBus(docReg, [], emptyDoc, context);

    const action = {
      type: "nonexistent",
      foo: "bar",
    } as unknown as DocumentAction;
    const result = bus.dispatch(action);

    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("unknown-action-type");
    expect(result.error?.actionType).toBe("nonexistent");
  });

  it("returns handler error code when DocumentHandlerError is thrown", () => {
    const docReg = createDocumentRegistry(() => ({
      ok: false,
      document: emptyDoc,
      error: {
        code: "document.handler-error",
        message: "should not be called",
      },
    }));
    const bus = createDocumentCommandBus(docReg, [], docWithPage, context);

    const action: DocumentAction = {
      type: "create-page",
      page: { id: "p1", name: "Dup", sceneId: "s2" },
      scene: emptyPersistedScene,
    };

    const result = bus.dispatch(action);
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("document.duplicate-page-id");
  });

  it("returns handler-error for unknown exceptions thrown from handler", () => {
    const throwingRegistry = new ActionRegistry<
      DocumentAction,
      VisualDocument,
      DocumentRuntimeContext
    >();
    throwingRegistry.register("create-page", {
      handler: () => {
        throw new Error("Kaboom!");
      },
      inverse: () => undefined,
      meta: { undoable: true, mergeable: false, devtoolsLabel: "" },
    });

    const bus = createDocumentCommandBus(
      throwingRegistry,
      [],
      emptyDoc,
      context,
    );

    const action: DocumentAction = {
      type: "create-page",
      page: { id: "p1", name: "Page 1", sceneId: "s1" },
      scene: emptyPersistedScene,
    };

    const result = bus.dispatch(action);
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("handler-error");
    expect(result.error?.message).toBe("Kaboom!");
  });

  it("returns middleware-error when middleware chain is broken", () => {
    const docReg = createDocumentRegistry(() => ({
      ok: false,
      document: emptyDoc,
      error: {
        code: "document.handler-error",
        message: "should not be called",
      },
    }));
    const bus = createDocumentCommandBus(
      docReg,
      [undefined as unknown as DocumentMiddleware],
      emptyDoc,
      context,
    );

    const action: DocumentAction = {
      type: "create-page",
      page: { id: "p1", name: "Page 1", sceneId: "s1" },
      scene: emptyPersistedScene,
    };

    const result = bus.dispatch(action);
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("middleware-error");
  });

  it("runs middleware pipeline before handler and passes modified document", () => {
    const docReg = createDocumentRegistry(() => ({
      ok: false,
      document: emptyDoc,
      error: {
        code: "document.handler-error",
        message: "should not be called",
      },
    }));
    let middlewareCalled = false;
    const trackingMiddleware: DocumentMiddleware = (_action, _doc, next) => {
      middlewareCalled = true;
      return next();
    };
    const bus = createDocumentCommandBus(
      docReg,
      [trackingMiddleware],
      emptyDoc,
      context,
    );

    const action: DocumentAction = {
      type: "create-page",
      page: { id: "p1", name: "Page 1", sceneId: "s1" },
      scene: emptyPersistedScene,
    };

    const result = bus.dispatch(action);
    expect(result.ok).toBe(true);
    expect(middlewareCalled).toBe(true);
  });

  it("catches handler that mutates frozen document and returns handler-error", () => {
    const mutatingRegistry = new ActionRegistry<
      DocumentAction,
      VisualDocument,
      DocumentRuntimeContext
    >();
    mutatingRegistry.register("test-action", {
      handler: (doc) => {
        (doc.pages as Array<unknown>).push({ id: "p99" });
        return doc as import("../src/types.js").VisualDocument;
      },
      inverse: () => undefined,
      meta: { undoable: true, mergeable: false, devtoolsLabel: "" },
    });

    const bus = createDocumentCommandBus(
      mutatingRegistry,
      [],
      emptyDoc,
      context,
    );
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = bus.dispatch({
      type: "test-action",
    } as unknown as DocumentAction);

    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("handler-error");
    consoleSpy.mockRestore();
  });

  it("warns when handler returns same object reference (in-place mutation)", () => {
    const sameRefRegistry = new ActionRegistry<
      DocumentAction,
      VisualDocument,
      DocumentRuntimeContext
    >();
    sameRefRegistry.register("test-action", {
      handler: (doc) => doc as import("../src/types.js").VisualDocument,
      inverse: () => undefined,
      meta: { undoable: true, mergeable: false, devtoolsLabel: "" },
    });

    const bus = createDocumentCommandBus(
      sameRefRegistry,
      [],
      emptyDoc,
      context,
    );
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = bus.dispatch({
      type: "test-action",
    } as unknown as DocumentAction);

    expect(result.ok).toBe(true);
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("same object reference"),
    );
    consoleSpy.mockRestore();
  });

  it("getDocument returns the current document", () => {
    const docReg = createDocumentRegistry(() => ({
      ok: false,
      document: emptyDoc,
      error: {
        code: "document.handler-error",
        message: "should not be called",
      },
    }));
    const bus = createDocumentCommandBus(docReg, [], emptyDoc, context);

    const doc = bus.getDocument();
    expect(doc).toBe(emptyDoc);
  });
});
