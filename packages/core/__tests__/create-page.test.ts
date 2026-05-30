import { describe, expect, it } from "vitest";
import { createPageHandler } from "../src/document/handlers/create-page.js";
import { HandlerError } from "../src/engine/error.js";
import type { VisualDocument } from "../src/types.js";
import { emptyDoc, emptyPersistedScene } from "./helpers.js";

describe("createPageHandler", () => {
  it("adds a new page and scene to the document", () => {
    const action = {
      type: "create-page" as const,
      page: { id: "p1", name: "Page 1", sceneId: "s1" },
      scene: emptyPersistedScene,
    };
    const result = createPageHandler(emptyDoc, action, { now: Date.now });
    expect(result.pages).toHaveLength(1);
    expect(result.pages[0]?.name).toBe("Page 1");
    expect(result.scenes.s1).toBe(emptyPersistedScene);
  });

  it("appends a second page without affecting the first", () => {
    const doc: VisualDocument = {
      ...emptyDoc,
      pages: [{ id: "p1", name: "Page 1", sceneId: "s1" }],
      scenes: { s1: emptyPersistedScene },
    };
    const action = {
      type: "create-page" as const,
      page: { id: "p2", name: "Page 2", sceneId: "s2" },
      scene: { ...emptyPersistedScene, version: 1 },
    };
    const result = createPageHandler(doc, action, { now: Date.now });
    expect(result.pages).toHaveLength(2);
    expect(result.scenes.s2?.version).toBe(1);
  });

  it("rejects duplicate page id", () => {
    const docWithPage: VisualDocument = {
      ...emptyDoc,
      pages: [{ id: "p1", name: "Page 1", sceneId: "s1" }],
      scenes: { s1: emptyPersistedScene },
    };
    const action = {
      type: "create-page" as const,
      page: { id: "p1", name: "Dup", sceneId: "s2" },
      scene: emptyPersistedScene,
    };
    expect(() =>
      createPageHandler(docWithPage, action, { now: Date.now }),
    ).toThrow(HandlerError);
    try {
      createPageHandler(docWithPage, action, { now: Date.now });
    } catch (e) {
      expect((e as HandlerError).code).toBe("document.duplicate-page-id");
    }
  });

  it("rejects duplicate scene id", () => {
    const doc: VisualDocument = {
      ...emptyDoc,
      pages: [{ id: "p1", name: "Page 1", sceneId: "s1" }],
      scenes: { s1: emptyPersistedScene },
    };
    const action = {
      type: "create-page" as const,
      page: { id: "p2", name: "Dup Scene", sceneId: "s1" },
      scene: emptyPersistedScene,
    };
    expect(() => createPageHandler(doc, action, { now: Date.now })).toThrow(
      HandlerError,
    );
    try {
      createPageHandler(doc, action, { now: Date.now });
    } catch (e) {
      expect((e as HandlerError).code).toBe("document.duplicate-scene-id");
    }
  });

  it("rejects duplicate route", () => {
    const docWithRoute: VisualDocument = {
      ...emptyDoc,
      pages: [{ id: "p1", name: "Page 1", sceneId: "s1", route: "/dashboard" }],
      scenes: { s1: emptyPersistedScene },
    };
    const action = {
      type: "create-page" as const,
      page: { id: "p2", name: "Dup Route", sceneId: "s2", route: "/dashboard" },
      scene: {
        ...emptyPersistedScene,
        rootId: "root-2",
        nodes: { "root-2": { id: "root-2", type: "container" } },
      },
    };
    expect(() =>
      createPageHandler(docWithRoute, action, { now: Date.now }),
    ).toThrow(HandlerError);
    try {
      createPageHandler(docWithRoute, action, { now: Date.now });
    } catch (e) {
      expect((e as HandlerError).code).toBe("document.duplicate-route");
    }
  });

  it("normalizes route when creating page with non-canonical route", () => {
    const action = {
      type: "create-page" as const,
      page: { id: "p1", name: "Page 1", sceneId: "s1", route: "Dashboard" },
      scene: emptyPersistedScene,
    };
    const result = createPageHandler(emptyDoc, action, { now: Date.now });
    expect(result.pages[0]?.route).toBe("/dashboard");
  });
});
