import { describe, expect, it } from "vitest";
import type { PersistedSceneGraph, VisualDocument } from "../../types.js";
import { createPageHandler } from "./create-page.js";

const emptyDoc: VisualDocument = {
  id: "doc-1",
  title: "Test",
  pages: [],
  scenes: {},
};

const emptyScene: PersistedSceneGraph = {
  version: 0,
  rootId: "root-1",
  nodes: { "root-1": { id: "root-1", type: "container" } },
};

describe("createPageHandler", () => {
  it("adds a new page and scene to the document", () => {
    const action = {
      type: "create-page" as const,
      page: { id: "p1", name: "Page 1", sceneId: "s1" },
      scene: emptyScene,
    };
    const result = createPageHandler(emptyDoc, action, { now: Date.now });
    expect(result.pages).toHaveLength(1);
    expect(result.pages[0]?.name).toBe("Page 1");
    expect(result.scenes.s1).toBe(emptyScene);
  });

  it("appends a second page without affecting the first", () => {
    const doc: VisualDocument = {
      ...emptyDoc,
      pages: [{ id: "p1", name: "Page 1", sceneId: "s1" }],
      scenes: { s1: emptyScene },
    };
    const action = {
      type: "create-page" as const,
      page: { id: "p2", name: "Page 2", sceneId: "s2" },
      scene: { ...emptyScene, version: 1 },
    };
    const result = createPageHandler(doc, action, { now: Date.now });
    expect(result.pages).toHaveLength(2);
    expect(result.scenes.s2?.version).toBe(1);
  });
});
