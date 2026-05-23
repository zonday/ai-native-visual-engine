import { describe, expect, it } from "vitest";
import type { PersistedSceneGraph, VisualDocument } from "../../types.js";
import { removePageHandler } from "./remove-page.js";

const emptyScene: PersistedSceneGraph = {
  version: 0,
  rootId: "root-1",
  nodes: { "root-1": { id: "root-1", type: "container" } },
};

const doc: VisualDocument = {
  id: "doc-1",
  title: "Test",
  pages: [
    { id: "p1", name: "Page 1", sceneId: "s1" },
    { id: "p2", name: "Page 2", sceneId: "s2" },
  ],
  scenes: { s1: emptyScene, s2: { ...emptyScene, version: 1 } },
};

describe("removePageHandler", () => {
  it("removes the page and its scene", () => {
    const action = { type: "remove-page" as const, pageId: "p1" };
    const result = removePageHandler(doc, action, { now: Date.now });
    expect(result.pages).toHaveLength(1);
    expect(result.pages[0]?.id).toBe("p2");
    expect(result.scenes).not.toHaveProperty("s1");
    expect(result.scenes.s2).toBeDefined();
  });

  it("returns the document unchanged when page not found", () => {
    const action = { type: "remove-page" as const, pageId: "missing" };
    const result = removePageHandler(doc, action, { now: Date.now });
    expect(result.pages).toHaveLength(2);
    expect(result.scenes).toHaveProperty("s1");
  });
});
