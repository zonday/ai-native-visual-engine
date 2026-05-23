import { describe, expect, it } from "vitest";
import { VisualDocumentSchema } from "./types.js";

describe("VisualDocumentSchema", () => {
  it("validates a minimal valid document", () => {
    const doc = {
      id: "doc-1",
      title: "Test Document",
      pages: [],
      scenes: {},
    };
    expect(VisualDocumentSchema.safeParse(doc).success).toBe(true);
  });

  it("rejects document missing required fields", () => {
    expect(VisualDocumentSchema.safeParse({}).success).toBe(false);
  });

  it("validates document with pages and scenes", () => {
    const doc = {
      id: "doc-1",
      title: "Multi Page",
      pages: [{ id: "p1", name: "Page 1", sceneId: "s1" }],
      scenes: {
        s1: { version: 0, rootId: "root-1", nodes: {} },
      },
    };
    const result = VisualDocumentSchema.safeParse(doc);
    expect(result.success).toBe(true);
  });

  it("validates document with optional fields", () => {
    const doc = {
      id: "doc-1",
      title: "Full Doc",
      pages: [],
      scenes: {},
      activeThemeId: "theme-dark",
      themes: [{ id: "theme-dark", name: "Dark", tokens: {} }],
      variables: [{ id: "v1", name: "app-name", type: "string" as const }],
    };
    expect(VisualDocumentSchema.safeParse(doc).success).toBe(true);
  });

  it("rejects pages with invalid type", () => {
    const doc = {
      id: "doc-1",
      title: "Bad Doc",
      pages: [{ id: 123, name: "Bad", sceneId: "s1" }],
      scenes: {},
    };
    expect(VisualDocumentSchema.safeParse(doc).success).toBe(false);
  });
});
