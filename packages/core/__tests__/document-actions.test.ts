import { describe, expect, it } from "vitest";
import { DocumentActionSchema } from "../src/document/actions.js";

describe("DocumentActionSchema", () => {
  it("validates create-page action", () => {
    const action = {
      type: "create-page",
      page: { id: "p1", name: "Page 1", sceneId: "s1" },
      scene: { version: 0, rootId: "root-1", nodes: {} },
    };
    expect(DocumentActionSchema.safeParse(action).success).toBe(true);
  });

  it("rejects create-page with missing page", () => {
    const action = {
      type: "create-page",
      scene: { version: 0, rootId: "r1", nodes: {} },
    };
    expect(DocumentActionSchema.safeParse(action).success).toBe(false);
  });

  it("validates remove-page action", () => {
    const action = { type: "remove-page", pageId: "p1" };
    expect(DocumentActionSchema.safeParse(action).success).toBe(true);
  });

  it("validates rename-page action", () => {
    const action = { type: "rename-page", pageId: "p1", name: "New Name" };
    expect(DocumentActionSchema.safeParse(action).success).toBe(true);
  });

  it("validates reorder-page action", () => {
    const action = { type: "reorder-page", pageId: "p1", index: 2 };
    expect(DocumentActionSchema.safeParse(action).success).toBe(true);
  });

  it("rejects reorder-page with negative index", () => {
    const action = { type: "reorder-page", pageId: "p1", index: -1 };
    expect(DocumentActionSchema.safeParse(action).success).toBe(false);
  });

  it("validates update-page-route action", () => {
    const action = {
      type: "update-page-route",
      pageId: "p1",
      route: "/dashboard",
    };
    expect(DocumentActionSchema.safeParse(action).success).toBe(true);
  });

  it("validates set-document-theme action", () => {
    const action = {
      type: "set-document-theme",
      themeId: "theme-dark",
    };
    expect(DocumentActionSchema.safeParse(action).success).toBe(true);
  });

  it("validates set-page-theme action", () => {
    const action = {
      type: "set-page-theme",
      pageId: "p1",
      themeId: "sales",
    };
    expect(DocumentActionSchema.safeParse(action).success).toBe(true);
  });

  it("rejects unknown action type", () => {
    const action = { type: "unknown-action" };
    expect(DocumentActionSchema.safeParse(action).success).toBe(false);
  });
});
