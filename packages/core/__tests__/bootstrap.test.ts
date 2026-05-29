import { describe, expect, it } from "vitest";
import {
  createEmptyScene,
  createNewDocument,
  generateId,
} from "../src/bootstrap.js";

function nonNull<T>(value: T): NonNullable<T> {
  return value as NonNullable<T>;
}

describe("createEmptyScene", () => {
  it("returns a PersistedSceneGraph with a single root node", () => {
    const scene = createEmptyScene();
    expect(scene.version).toBe(0);
    expect(scene.rootId).toBeDefined();
    expect(scene.nodes[scene.rootId]).toBeDefined();
    expect(scene.nodes[scene.rootId]?.type).toBe("container");
    expect(scene.nodes[scene.rootId]?.children).toEqual([]);
    expect(Object.keys(scene.nodes)).toHaveLength(1);
  });

  it("uses the provided rootId", () => {
    const scene = createEmptyScene("my-root");
    expect(scene.rootId).toBe("my-root");
    expect(scene.nodes["my-root"]).toBeDefined();
  });
});

describe("createNewDocument", () => {
  it("creates a document with one page and one scene", () => {
    const doc = createNewDocument();
    expect(doc.pages).toHaveLength(1);
    expect(doc.pages[0]?.name).toBe("Untitled");
    expect(doc.scenes[nonNull(doc.pages[0]).sceneId]).toBeDefined();
  });

  it("uses the provided title", () => {
    const doc = createNewDocument({ title: "My Doc" });
    expect(doc.title).toBe("My Doc");
    expect(doc.pages[0]?.name).toBe("My Doc");
  });

  it("sets the route on the first page when provided", () => {
    const doc = createNewDocument({ route: "/dashboard" });
    expect(doc.pages[0]?.route).toBe("/dashboard");
  });

  it("sets activeThemeId when themeId is provided", () => {
    const doc = createNewDocument({ themeId: "theme-dark" });
    expect(doc.activeThemeId).toBe("theme-dark");
  });

  it("generates unique IDs for document, page, and scene", () => {
    const doc1 = createNewDocument();
    const doc2 = createNewDocument();
    expect(doc1.id).not.toBe(doc2.id);
    expect(doc1.pages[0]?.id).not.toBe(doc2.pages[0]?.id);
    expect(doc1.pages[0]?.sceneId).not.toBe(doc2.pages[0]?.sceneId);
  });
});

describe("generateId", () => {
  it("generates unique IDs", () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId("test")));
    expect(ids.size).toBe(100);
  });

  it("includes the prefix", () => {
    const id = generateId("doc");
    expect(id.startsWith("doc-")).toBe(true);
  });
});
