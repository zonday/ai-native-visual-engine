import { describe, expect, it } from "vitest";
import { createNewDocument } from "../src/bootstrap.js";
import {
  exportDocumentSnapshot,
  importDocumentSnapshot,
} from "../src/io/import-export.js";

function nonNull<T>(value: T): NonNullable<T> {
  return value as NonNullable<T>;
}

describe("importDocumentSnapshot", () => {
  it("imports a valid DocumentSnapshot", () => {
    const doc = createNewDocument({ title: "Imported" });
    const result = importDocumentSnapshot({ document: doc });
    expect(result.ok).toBe(true);
    expect(result.document?.title).toBe("Imported");
  });

  it("round-trips an exported snapshot", () => {
    const doc = createNewDocument({ title: "Round Trip" });
    const snapshot = exportDocumentSnapshot(doc);

    const result = importDocumentSnapshot(snapshot);

    expect(result.ok).toBe(true);
    expect(result.document).toEqual(snapshot.document);
  });

  it("rejects invalid data with diagnostics", () => {
    const result = importDocumentSnapshot({ foo: "bar" });
    expect(result.ok).toBe(false);
    expect(result.diagnostics.length).toBeGreaterThan(0);
  });

  it("rejects malformed snapshot envelopes", () => {
    const result = importDocumentSnapshot({ document: { foo: "bar" } });

    expect(result.ok).toBe(false);
    expect(result.diagnostics.length).toBeGreaterThan(0);
  });

  it("rejects null", () => {
    const result = importDocumentSnapshot(null);
    expect(result.ok).toBe(false);
  });
});

describe("exportDocumentSnapshot", () => {
  it("exports the full document by default", () => {
    const doc = createNewDocument({ title: "Export" });
    const exported = exportDocumentSnapshot(doc);
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

    const firstPageId = nonNull(doc.pages[0]).id;
    const exported = exportDocumentSnapshot(doc, {
      targetPageIds: [firstPageId],
    });
    expect(exported.document.pages).toHaveLength(1);
    expect(exported.document.pages[0]?.id).toBe(firstPageId);
  });

  it("strips activeThemeId when includeThemes is false", () => {
    const doc = createNewDocument({ themeId: "dark" });
    const exported = exportDocumentSnapshot(doc, { includeThemes: false });
    expect(exported.document.activeThemeId).toBeUndefined();
  });
});
