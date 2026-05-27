import { describe, expect, it } from "vitest";
import { createNewDocument } from "../src/bootstrap.js";
import { exportDocument, importDocument } from "../src/import-export.js";

describe("importDocument", () => {
  it("imports a valid VisualDocument", () => {
    const doc = createNewDocument({ title: "Imported" });
    const result = importDocument(doc);
    expect(result.ok).toBe(true);
    expect(result.document?.title).toBe("Imported");
  });

  it("rejects invalid data with diagnostics", () => {
    const result = importDocument({ foo: "bar" });
    expect(result.ok).toBe(false);
    expect(result.diagnostics.length).toBeGreaterThan(0);
  });

  it("rejects null", () => {
    const result = importDocument(null);
    expect(result.ok).toBe(false);
  });
});

describe("exportDocument", () => {
  it("exports the full document by default", () => {
    const doc = createNewDocument({ title: "Export" });
    const exported = exportDocument(doc);
    expect(exported.document.pages).toHaveLength(1);
    expect(exported.document.id).toBe(doc.id);
  });

  it("exports only selected pages when targetPageIds is provided", () => {
    const doc = createNewDocument({ title: "Multi" });
    doc.pages.push({
      id: "page-2",
      name: "Page 2",
      sceneId: "scene-2",
    });
    doc.scenes["scene-2"] = {
      version: 0,
      rootId: "root-2",
      nodes: { "root-2": { id: "root-2", type: "container", children: [] } },
    };

    const exported = exportDocument(doc, { targetPageIds: [doc.pages[0]?.id] });
    expect(exported.document.pages).toHaveLength(1);
    expect(exported.document.pages[0]?.id).toBe(doc.pages[0]?.id);
  });

  it("strips activeThemeId when includeThemes is false", () => {
    const doc = createNewDocument({ themeId: "dark" });
    const exported = exportDocument(doc, { includeThemes: false });
    expect(exported.document.activeThemeId).toBeUndefined();
  });
});
