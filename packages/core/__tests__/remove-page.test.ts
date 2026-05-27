import { describe, expect, it } from "vitest";
import { DocumentHandlerError } from "../src/document/error.js";
import { removePageHandler } from "../src/document/handlers/remove-page.js";
import type { VisualDocument } from "../src/types.js";
import { emptyPersistedScene } from "./helpers.js";

const doc: VisualDocument = {
  id: "doc-1",
  title: "Test",
  pages: [
    { id: "p1", name: "Page 1", sceneId: "s1" },
    { id: "p2", name: "Page 2", sceneId: "s2" },
  ],
  scenes: {
    s1: emptyPersistedScene,
    s2: { ...emptyPersistedScene, version: 1 },
  },
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

  it("rejects when page not found", () => {
    const action = { type: "remove-page" as const, pageId: "missing" };
    expect(() => removePageHandler(doc, action, { now: Date.now })).toThrow(
      DocumentHandlerError,
    );
    try {
      removePageHandler(doc, action, { now: Date.now });
    } catch (e) {
      expect((e as DocumentHandlerError).code).toBe("document.page-not-found");
    }
  });
});
