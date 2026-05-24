import { describe, expect, it } from "vitest";
import type { VisualDocument } from "../src/types.js";
import { DocumentHandlerError } from "../src/document/error.js";
import { reorderPageHandler } from "../src/document/handlers/reorder-page.js";

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

  it("moves page to index 0", () => {
    const action = { type: "reorder-page" as const, pageId: "p3", index: 0 };
    const result = reorderPageHandler(doc, action, { now: Date.now });
    expect(result.pages[0]?.id).toBe("p3");
    expect(result.pages[1]?.id).toBe("p1");
    expect(result.pages[2]?.id).toBe("p2");
  });

  it("rejects when page not found", () => {
    const action = {
      type: "reorder-page" as const,
      pageId: "missing",
      index: 0,
    };
    expect(() => reorderPageHandler(doc, action, { now: Date.now })).toThrow(
      DocumentHandlerError,
    );
    try {
      reorderPageHandler(doc, action, { now: Date.now });
    } catch (e) {
      expect((e as DocumentHandlerError).code).toBe("document.page-not-found");
    }
  });

  it("rejects index equal to pages length", () => {
    const action = {
      type: "reorder-page" as const,
      pageId: "p1",
      index: 3,
    };
    expect(() => reorderPageHandler(doc, action, { now: Date.now })).toThrow(
      DocumentHandlerError,
    );
    try {
      reorderPageHandler(doc, action, { now: Date.now });
    } catch (e) {
      expect((e as DocumentHandlerError).code).toBe(
        "document.index-out-of-bounds",
      );
    }
  });

  it("rejects negative index", () => {
    const action = {
      type: "reorder-page" as const,
      pageId: "p1",
      index: -1,
    };
    expect(() => reorderPageHandler(doc, action, { now: Date.now })).toThrow(
      DocumentHandlerError,
    );
    try {
      reorderPageHandler(doc, action, { now: Date.now });
    } catch (e) {
      expect((e as DocumentHandlerError).code).toBe(
        "document.index-out-of-bounds",
      );
    }
  });
});