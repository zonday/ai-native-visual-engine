import { describe, expect, it } from "vitest";
import type { VisualDocument } from "../../types.js";
import { setDocumentThemeHandler } from "./set-document-theme.js";
import { setPageThemeHandler } from "./set-page-theme.js";
import { normalizeRoute, updatePageRouteHandler } from "./update-page-route.js";

const doc: VisualDocument = {
  id: "doc-1",
  title: "Test",
  pages: [{ id: "p1", name: "Page 1", sceneId: "s1" }],
  scenes: {},
};

describe("setDocumentThemeHandler", () => {
  it("sets document theme", () => {
    const action = {
      type: "set-document-theme" as const,
      themeId: "theme-dark",
    };
    const result = setDocumentThemeHandler(doc, action, { now: Date.now });
    expect(result.activeThemeId).toBe("theme-dark");
  });

  it("clears document theme when themeId is undefined", () => {
    const themedDoc: VisualDocument = { ...doc, activeThemeId: "theme-dark" };
    const action = { type: "set-document-theme" as const, themeId: undefined };
    const result = setDocumentThemeHandler(themedDoc, action, {
      now: Date.now,
    });
    expect(result.activeThemeId).toBeUndefined();
  });
});

describe("setPageThemeHandler", () => {
  it("sets page theme override", () => {
    const action = {
      type: "set-page-theme" as const,
      pageId: "p1",
      themeId: "sales",
    };
    const result = setPageThemeHandler(doc, action, { now: Date.now });
    expect(result.pages[0]?.themeId).toBe("sales");
  });

  it("clears page theme when themeId is undefined", () => {
    const themedDoc: VisualDocument = {
      ...doc,
      pages: [{ id: "p1", name: "Page 1", sceneId: "s1", themeId: "old" }],
    };
    const action = {
      type: "set-page-theme" as const,
      pageId: "p1",
      themeId: undefined,
    };
    const result = setPageThemeHandler(themedDoc, action, { now: Date.now });
    expect(result.pages[0]?.themeId).toBeUndefined();
  });
});

describe("normalizeRoute", () => {
  it("lowercases and adds leading slash", () => {
    expect(normalizeRoute("Dashboard")).toBe("/dashboard");
  });

  it("trims whitespace", () => {
    expect(normalizeRoute("  /Sales/Overview  ")).toBe("/sales/overview");
  });
});

describe("updatePageRouteHandler", () => {
  it("updates page route", () => {
    const action = {
      type: "update-page-route" as const,
      pageId: "p1",
      route: "/dashboard",
    };
    const result = updatePageRouteHandler(doc, action, { now: Date.now });
    expect(result.pages[0]?.route).toBe("/dashboard");
  });

  it("normalizes the route before storing", () => {
    const action = {
      type: "update-page-route" as const,
      pageId: "p1",
      route: "DASHBOARD",
    };
    const result = updatePageRouteHandler(doc, action, { now: Date.now });
    expect(result.pages[0]?.route).toBe("/dashboard");
  });
});
