import { describe, expect, it } from "vitest";
import type { DocumentAction } from "../src/document/actions.js";
import type { HistoryState } from "../src/engine/history.js";

type DocumentHistoryState = HistoryState<DocumentAction>;

import { createDocumentRegistry } from "../src/document/register-handlers.js";
import { createUndoHistoryMiddleware } from "../src/engine/history-middleware.js";
import { emptyDoc, emptyPersistedScene } from "./helpers.js";

describe("createUndoHistoryMiddleware", () => {
  it("pushes history entry on successful dispatch", () => {
    const reg = createDocumentRegistry();

    let history: DocumentHistoryState = { undoStack: [], redoStack: [] };
    const middleware = createUndoHistoryMiddleware(
      () => history,
      (s) => {
        history = s;
      },
      () => "actor-from-getter",
      reg,
      () => ({ now: Date.now, actorId: "actor-from-context" }),
    );

    const action: DocumentAction = {
      type: "create-page",
      page: { id: "p1", name: "Page 1", sceneId: "s1" },
      scene: emptyPersistedScene,
    };

    const next = () => ({
      ok: true as const,
      state: {
        ...emptyDoc,
        pages: [{ id: "p1", name: "Page 1", sceneId: "s1" }],
        scenes: { s1: emptyPersistedScene },
      },
    });

    const result = middleware(action, emptyDoc, next);
    expect(result.ok).toBe(true);
    expect(history.undoStack).toHaveLength(1);
    expect(history.undoStack[0]?.action).toEqual(action);
    expect(history.undoStack[0]?.actorId).toBe("actor-from-getter");
  });

  it("does not push history entry when dispatch fails", () => {
    const reg = createDocumentRegistry();

    let history: DocumentHistoryState = { undoStack: [], redoStack: [] };
    const middleware = createUndoHistoryMiddleware(
      () => history,
      (s) => {
        history = s;
      },
      () => "test-actor",
      reg,
      () => ({ now: Date.now }),
    );

    const action: DocumentAction = {
      type: "create-page",
      page: { id: "p1", name: "Page 1", sceneId: "s1" },
      scene: emptyPersistedScene,
    };

    const next = () => ({
      ok: false as const,
      state: emptyDoc,
      error: { code: "document.page-not-found", message: "not found" },
    });

    const result = middleware(action, emptyDoc, next);
    expect(result.ok).toBe(false);
    expect(history.undoStack).toHaveLength(0);
  });

  it("throws when batch inverse computer encounters batch action", () => {
    const reg = createDocumentRegistry();

    let history: DocumentHistoryState = { undoStack: [], redoStack: [] };
    const middleware = createUndoHistoryMiddleware(
      () => history,
      (s) => {
        history = s;
      },
      () => "test-actor",
      reg,
      () => ({ now: Date.now }),
    );

    const action: DocumentAction = {
      type: "batch-document-actions",
      actions: [{ type: "rename-page", pageId: "p1", name: "New" }],
    };

    const next = () => ({
      ok: true as const,
      state: emptyDoc,
    });

    expect(() => middleware(action, emptyDoc, next)).toThrow(
      "Batch inverse must be computed by the transaction manager",
    );
  });

  it("uses actorId from context when getActorId returns undefined", () => {
    const reg = createDocumentRegistry();

    let history: DocumentHistoryState = { undoStack: [], redoStack: [] };
    const middleware = createUndoHistoryMiddleware(
      () => history,
      (s) => {
        history = s;
      },
      () => undefined,
      reg,
      () => ({ now: Date.now, actorId: "actor-from-context" }),
    );

    const action: DocumentAction = {
      type: "create-page",
      page: { id: "p1", name: "Page 1", sceneId: "s1" },
      scene: emptyPersistedScene,
    };

    const next = () => ({
      ok: true as const,
      state: {
        ...emptyDoc,
        pages: [{ id: "p1", name: "Page 1", sceneId: "s1" }],
        scenes: { s1: emptyPersistedScene },
      },
    });

    middleware(action, emptyDoc, next);
    expect(history.undoStack[0]?.actorId).toBe("actor-from-context");
  });
});
