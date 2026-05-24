import { describe, it, expect } from "vitest";
import type { VisualDocument } from "../src/types.js";
import { renamePageHandler } from "../src/document/handlers/rename-page.js";
import { DocumentHandlerError } from "../src/document/error.js";

const doc: VisualDocument = {
  id: "doc-1",
  title: "Test",
  pages: [{ id: "p1", name: "Page 1", sceneId: "s1" }],
  scenes: {},
};

describe("renamePageHandler", () => {
  it("renames the page", () => {
    const action = {
      type: "rename-page" as const,
      pageId: "p1",
      name: "Renamed",
    };
    const result = renamePageHandler(doc, action, { now: Date.now });
    expect(result.pages[0]?.name).toBe("Renamed");
  });

  it("leaves other pages unchanged", () => {
    const multiDoc: VisualDocument = {
      ...doc,
      pages: [
        { id: "p1", name: "Page 1", sceneId: "s1" },
        { id: "p2", name: "Page 2", sceneId: "s2" },
      ],
    };
    const action = {
      type: "rename-page" as const,
      pageId: "p1",
      name: "Renamed",
    };
    const result = renamePageHandler(multiDoc, action, { now: Date.now });
    expect(result.pages[1]?.name).toBe("Page 2");
  });

  it("rejects when page not found", () => {
    const action = {
      type: "rename-page" as const,
      pageId: "missing",
      name: "Nope",
    };
    expect(() => renamePageHandler(doc, action, { now: Date.now })).toThrow(
      DocumentHandlerError,
    );
    try {
      renamePageHandler(doc, action, { now: Date.now });
    } catch (e) {
      expect((e as DocumentHandlerError).code).toBe("document.page-not-found");
    }
  });
});
