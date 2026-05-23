import { describe, expect, it } from "vitest";
import type { VisualDocument } from "../../types.js";
import { reorderPageHandler } from "./reorder-page.js";

const doc: VisualDocument = {
  id: "doc-1",
  title: "Test",
  pages: [
    { id: "p1", name: "Page 1", sceneId: "s1" },
    { id: "p2", name: "Page 2", sceneId: "s2" },
    { id: "p3", name: "Page 3", sceneId: "s3" },
  ],
  scenes: {},
};

describe("reorderPageHandler", () => {
  it("moves page to new index", () => {
    const action = { type: "reorder-page" as const, pageId: "p1", index: 2 };
    const result = reorderPageHandler(doc, action, { now: Date.now });
    expect(result.pages[0]?.id).toBe("p2");
    expect(result.pages[1]?.id).toBe("p3");
    expect(result.pages[2]?.id).toBe("p1");
  });

  it("clamps out-of-bounds index to end", () => {
    const action = { type: "reorder-page" as const, pageId: "p1", index: 999 };
    const result = reorderPageHandler(doc, action, { now: Date.now });
    expect(result.pages[2]?.id).toBe("p1");
  });

  it("returns unchanged when page not found", () => {
    const action = {
      type: "reorder-page" as const,
      pageId: "missing",
      index: 0,
    };
    const result = reorderPageHandler(doc, action, { now: Date.now });
    expect(result.pages).toEqual(doc.pages);
  });
});
