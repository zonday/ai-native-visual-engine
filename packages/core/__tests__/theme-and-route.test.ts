import { describe, expect, it } from "vitest";
import type { VisualDocument } from "../src/types.js";
import { DocumentHandlerError } from "../src/document/error.js";
import { setDocumentThemeHandler } from "../src/document/handlers/set-document-theme.js";
import { setPageThemeHandler } from "../src/document/handlers/set-page-theme.js";
import { normalizeRoute, updatePageRouteHandler } from "../src/document/handlers/update-page-route.js";

const doc: VisualDocument = {
  id: "doc-1",
  title: "Test",
  pages: [{ id: "p1", name: "Page 1", sceneId: "s1" }],
  scenes: {},
};

const themedDoc: VisualDocument = {
  ...doc,
  themes: [
    { id: "theme-dark", name: "Dark", tokens: {} },
    { id: "theme-light", name: "Light", tokens: {} },
  ],
};

describe("setDocumentThemeHandler", () => {
  it("sets document theme", () => {
    const action = {
      type: "set-document-theme" as const,
      themeId: "theme-dark",
    };
    const result = setDocumentThemeHandler(themedDoc, action, { now: Date.now });
    expect(result.activeThemeId).toBe("theme-dark");
  });

  it("clears document theme when themeId is undefined", () => {
    const alreadyThemed: VisualDocument = {
      ...themedDoc,
      activeThemeId: "theme-dark",
    };
    const action = { type: "set-document-theme" as const, themeId: undefined };
    const result = setDocumentThemeHandler(alreadyThemed, action, {
      now: Date.now,
    });
    expect(result.activeThemeId).toBeUndefined();
  });

  it("rejects unknown themeId when document has themes", () => {
    const action = {
      type: "set-document-theme" as const,
      themeId: "nonexistent",
    };
    expect(() =>
      setDocumentThemeHandler(themedDoc, action, { now: Date.now }),
    ).toThrow(DocumentHandlerError);
    try {
      setDocumentThemeHandler(themedDoc, action, { now: Date.now });
    } catch (e) {
      expect((e as DocumentHandlerError).code).toBe(
        "document.theme-not-found",
      );
    }
  });

  it("allows any themeId when document has no themes array", () => {
    const action = {
      type: "set-document-theme" as const,
      themeId: "any-theme",
    };
    const result = setDocumentThemeHandler(doc, action, { now: Date.now });
    expect(result.activeThemeId).toBe("any-theme");
  });
});

describe("setPageThemeHandler", () => {
  it("sets page theme override", () => {
    const action = {
      type: "set-page-theme" as const,
      pageId: "p1",
      themeId: "theme-dark",
    };
    const result = setPageThemeHandler(themedDoc, action, { now: Date.now });
    expect(result.pages[0]?.themeId).toBe("theme-dark");
  });

  it("clears page theme when themeId is undefined", () => {
    const alreadyThemed: VisualDocument = {
      ...themedDoc,
      pages: [{ id: "p1", name: "Page 1", sceneId: "s1", themeId: "old" }],
    };
    const action = {
      type: "set-page-theme" as const,
      pageId: "p1",
      themeId: undefined,
    };
    const result = setPageThemeHandler(alreadyThemed, action, {
      now: Date.now,
    });
    expect(result.pages[0]?.themeId).toBeUndefined();
  });

  it("rejects when page not found", () => {
    const action = {
      type: "set-page-theme" as const,
      pageId: "missing",
      themeId: "dark",
    };
    expect(() => setPageThemeHandler(doc, action, { now: Date.now })).toThrow(
      DocumentHandlerError,
    );
    try {
      setPageThemeHandler(doc, action, { now: Date.now });
    } catch (e) {
      expect((e as DocumentHandlerError).code).toBe("document.page-not-found");
    }
  });

  it("rejects unknown themeId when document has themes", () => {
    const action = {
      type: "set-page-theme" as const,
      pageId: "p1",
      themeId: "nonexistent",
    };
    expect(() =>
      setPageThemeHandler(themedDoc, action, { now: Date.now }),
    ).toThrow(DocumentHandlerError);
    try {
      setPageThemeHandler(themedDoc, action, { now: Date.now });
    } catch (e) {
      expect((e as DocumentHandlerError).code).toBe(
        "document.theme-not-found",
      );
    }
  });

  it("allows any themeId when document has no themes array", () => {
    const action = {
      type: "set-page-theme" as const,
      pageId: "p1",
      themeId: "any-theme",
    };
    const result = setPageThemeHandler(doc, action, { now: Date.now });
    expect(result.pages[0]?.themeId).toBe("any-theme");
  });
});

describe("normalizeRoute", () => {
  it("lowercases and adds leading slash", () => {
    expect(normalizeRoute("Dashboard")).toBe("/dashboard");
  });

  it("trims whitespace", () => {
    expect(normalizeRoute("  /Sales/Overview  ")).toBe("/sales/overview");
  });

  it("returns empty string for whitespace-only input", () => {
    expect(normalizeRoute("   ")).toBe("");
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

  it("rejects when page not found", () => {
    const action = {
      type: "update-page-route" as const,
      pageId: "missing",
      route: "/settings",
    };
    expect(() =>
      updatePageRouteHandler(doc, action, { now: Date.now }),
    ).toThrow(DocumentHandlerError);
    try {
      updatePageRouteHandler(doc, action, { now: Date.now });
    } catch (e) {
      expect((e as DocumentHandlerError).code).toBe("document.page-not-found");
    }
  });

  it("rejects duplicate route on different page", () => {
    const multiDoc: VisualDocument = {
      ...doc,
      pages: [
        { id: "p1", name: "Page 1", sceneId: "s1", route: "/dashboard" },
        { id: "p2", name: "Page 2", sceneId: "s2" },
      ],
    };
    const action = {
      type: "update-page-route" as const,
      pageId: "p2",
      route: "/dashboard",
    };
    expect(() =>
      updatePageRouteHandler(multiDoc, action, { now: Date.now }),
    ).toThrow(DocumentHandlerError);
    try {
      updatePageRouteHandler(multiDoc, action, { now: Date.now });
    } catch (e) {
      expect((e as DocumentHandlerError).code).toBe(
        "document.duplicate-route",
      );
    }
  });

  it("rejects empty or whitespace-only route", () => {
    const action = {
      type: "update-page-route" as const,
      pageId: "p1",
      route: "   ",
    };
    expect(() =>
      updatePageRouteHandler(doc, action, { now: Date.now }),
    ).toThrow(DocumentHandlerError);
    try {
      updatePageRouteHandler(doc, action, { now: Date.now });
    } catch (e) {
      expect((e as DocumentHandlerError).code).toBe(
        "document.invalid-route",
      );
    }
  });
});