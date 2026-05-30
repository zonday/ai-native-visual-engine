import { describe, expect, it } from "vitest";
import { createDocumentCommandBus } from "../src/document/document-command-bus.js";
import type { DocumentRuntimeContext } from "../src/document/handler-registry.js";
import { computeBatchInverse } from "../src/document/handlers/batch.js";
import { setPageThemeEntry } from "../src/document/handlers/set-page-theme.js";
import { updatePageRouteEntry } from "../src/document/handlers/update-page-route.js";
import { normalizeRoute } from "../src/document/normalize-route.js";
import type { DocumentAction } from "../src/document/register-handlers.js";
import { ActionRegistry } from "../src/engine/action-registry.js";
import { HandlerError } from "../src/engine/error.js";
import type { HistoryState } from "../src/engine/history.js";

type DocumentHistoryState = HistoryState<DocumentAction>;

import { createUndoHistoryMiddleware } from "../src/engine/history-middleware.js";
import type { VisualDocument } from "../src/types.js";
import { emptyDoc, emptyPersistedScene } from "./helpers.js";

const context: DocumentRuntimeContext = { now: Date.now };

describe("command bus - error response branches", () => {
  it("uses action.type fallback when HandlerError has no actionType", () => {
    const registry = new ActionRegistry<
      DocumentAction,
      VisualDocument,
      DocumentRuntimeContext
    >();
    registry.register("test-action", {
      handler: () => {
        throw new HandlerError(
          "document.custom-error",
          "no actionType on this error",
        );
      },
      inverse: () => undefined,
      meta: { undoable: true, mergeable: false, devtoolsLabel: "" },
    });

    const bus = createDocumentCommandBus(registry, [], emptyDoc, context);
    const result = bus.dispatch({
      type: "test-action",
    } as unknown as DocumentAction);

    expect(result.ok).toBe(false);
    expect(result.error?.actionType).toBe("test-action");
  });

  it("preserves thrown value in error message when handler throws non-Error", () => {
    const registry = new ActionRegistry<
      DocumentAction,
      VisualDocument,
      DocumentRuntimeContext
    >();
    registry.register("test-action", {
      handler: () => {
        throw "string error";
      },
      inverse: () => undefined,
      meta: { undoable: true, mergeable: false, devtoolsLabel: "" },
    });

    const bus = createDocumentCommandBus(registry, [], emptyDoc, context);
    const result = bus.dispatch({
      type: "test-action",
    } as unknown as DocumentAction);

    expect(result.ok).toBe(false);
    expect(result.error?.message).toBe("string error");
  });
});

describe("history middleware - branch for entry without inverse", () => {
  it("does not push history when action has no inverse computer in registry", () => {
    const registry = new ActionRegistry<
      DocumentAction,
      VisualDocument,
      DocumentRuntimeContext
    >();
    registry.register("no-inverse-action", {
      handler: (
        doc: VisualDocument,
        _action: DocumentAction,
        _ctx: DocumentRuntimeContext,
      ) => doc,
    });

    let history: DocumentHistoryState = { undoStack: [], redoStack: [] };
    const middleware = createUndoHistoryMiddleware(
      () => history,
      (s) => {
        history = s;
      },
      () => "test-actor",
      registry,
      () => ({ now: Date.now }),
    );

    const action = { type: "no-inverse-action" } as unknown as DocumentAction;
    const next = () => ({ ok: true as const, state: emptyDoc });

    middleware(action, emptyDoc, next);
    expect(history.undoStack).toHaveLength(0);
  });
});

describe("computeBatchInverse", () => {
  it("returns undefined for empty actions list", () => {
    const result = computeBatchInverse(
      emptyDoc,
      { type: "batch-document-actions", actions: [] },
      () => ({ ok: true, document: emptyDoc }),
      { now: Date.now },
      () => undefined,
    );
    expect(result).toBeUndefined();
  });

  it("computes inverse for single child action", () => {
    const docWithPage: VisualDocument = {
      ...emptyDoc,
      pages: [{ id: "p1", name: "Page 1", sceneId: "s1" }],
      scenes: { s1: emptyPersistedScene },
    };

    const inverseOf = (
      _doc: VisualDocument,
      _act: DocumentAction,
      _ctx: DocumentRuntimeContext,
    ) => {
      return {
        type: "rename-page",
        pageId: "p1",
        name: "Old",
      } as DocumentAction;
    };

    const result = computeBatchInverse(
      docWithPage,
      {
        type: "batch-document-actions",
        actions: [{ type: "rename-page", pageId: "p1", name: "New" }],
      },
      () => ({ ok: true, document: docWithPage }),
      { now: Date.now },
      inverseOf,
    );
    expect(result).toEqual({
      type: "rename-page",
      pageId: "p1",
      name: "Old",
    } as DocumentAction);
  });

  it("computes inverse for multiple child actions in reverse order", () => {
    const docWithPage: VisualDocument = {
      ...emptyDoc,
      pages: [{ id: "p1", name: "Page 1", sceneId: "s1" }],
      scenes: { s1: emptyPersistedScene },
    };

    let step = 0;
    const inverseOf = (
      _doc: VisualDocument,
      _act: DocumentAction,
      _ctx: DocumentRuntimeContext,
    ) => {
      step++;
      return {
        type: "rename-page",
        pageId: "p1",
        name: `inverse-step-${step}`,
      } as DocumentAction;
    };
    const dispatch = () => ({ ok: true as const, document: docWithPage });

    const result = computeBatchInverse(
      docWithPage,
      {
        type: "batch-document-actions",
        actions: [
          { type: "rename-page", pageId: "p1", name: "Step 1" },
          { type: "rename-page", pageId: "p1", name: "Step 2" },
        ],
      },
      dispatch,
      { now: Date.now },
      inverseOf,
    );
    expect(result).toEqual({
      type: "batch-document-actions",
      actions: [
        { type: "rename-page", pageId: "p1", name: "inverse-step-2" },
        { type: "rename-page", pageId: "p1", name: "inverse-step-1" },
      ],
    });
  });

  it("returns undefined when all inverses are undefined", () => {
    const docWithPage: VisualDocument = {
      ...emptyDoc,
      pages: [{ id: "p1", name: "Page 1", sceneId: "s1" }],
      scenes: { s1: emptyPersistedScene },
    };

    const result = computeBatchInverse(
      docWithPage,
      {
        type: "batch-document-actions",
        actions: [{ type: "rename-page", pageId: "p1", name: "New" }],
      },
      () => ({ ok: true, document: docWithPage }),
      { now: Date.now },
      () => undefined,
    );
    expect(result).toBeUndefined();
  });

  it("stops processing when dispatch fails", () => {
    const docWithPage: VisualDocument = {
      ...emptyDoc,
      pages: [{ id: "p1", name: "Page 1", sceneId: "s1" }],
      scenes: { s1: emptyPersistedScene },
    };

    let callCount = 0;
    const inverseOf = (
      _doc: VisualDocument,
      _act: DocumentAction,
      _ctx: DocumentRuntimeContext,
    ) => {
      callCount++;
      return {
        type: "rename-page",
        pageId: "p1",
        name: `inverse-${callCount}`,
      } as DocumentAction;
    };
    const dispatch = () => ({
      ok: false as const,
      document: docWithPage,
      error: { code: "error", message: "fail" },
    });

    const result = computeBatchInverse(
      docWithPage,
      {
        type: "batch-document-actions",
        actions: [
          { type: "rename-page", pageId: "p1", name: "Step 1" },
          { type: "rename-page", pageId: "p1", name: "Step 2" },
        ],
      },
      dispatch,
      { now: Date.now },
      inverseOf,
    );
    expect(callCount).toBe(1);
    expect(result).toEqual({
      type: "rename-page",
      pageId: "p1",
      name: "inverse-1",
    });
  });
});

describe("normalizeRoute edge cases", () => {
  it("returns empty string for route consisting only of slash", () => {
    expect(normalizeRoute("/")).toBe("");
    expect(normalizeRoute("//")).toBe("");
    expect(normalizeRoute("/   ")).toBe("");
  });
});

describe("setPageThemeEntry.handler - branch coverage", () => {
  it("updates theme on matching page and leaves others unchanged", () => {
    const doc: VisualDocument = {
      ...emptyDoc,
      themes: [{ id: "t1", name: "Theme 1", tokens: {} }],
      pages: [
        { id: "p1", name: "Page 1", sceneId: "s1" },
        { id: "p2", name: "Page 2", sceneId: "s2" },
      ],
      scenes: { s1: emptyPersistedScene, s2: emptyPersistedScene },
    };

    const result = setPageThemeEntry.handler(
      doc,
      { type: "set-page-theme", pageId: "p1", themeId: "t1" },
      { now: Date.now },
    );
    expect(result.pages[0]?.themeId).toBe("t1");
    expect(result.pages[1]?.themeId).toBeUndefined();
  });
});

describe("updatePageRouteEntry.handler - map callback branches", () => {
  it("updates route on matching page and leaves others unchanged", () => {
    const doc: VisualDocument = {
      ...emptyDoc,
      pages: [
        { id: "p1", name: "Page 1", sceneId: "s1", route: "/old" },
        { id: "p2", name: "Page 2", sceneId: "s2", route: "/other" },
      ],
      scenes: { s1: emptyPersistedScene, s2: emptyPersistedScene },
    };

    const result = updatePageRouteEntry.handler(
      doc,
      { type: "update-page-route", pageId: "p1", route: "/new" },
      { now: Date.now },
    );
    expect(result.pages[0]?.route).toBe("/new");
    expect(result.pages[1]?.route).toBe("/other");
  });
});
