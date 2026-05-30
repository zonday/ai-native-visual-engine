import { describe, expect, it } from "vitest";
import { setDocumentThemeEntry } from "../src/document/handlers/set-document-theme.js";
import { setPageThemeEntry } from "../src/document/handlers/set-page-theme.js";
import { updatePageRouteEntry } from "../src/document/handlers/update-page-route.js";
import { normalizeRoute } from "../src/document/normalize-route.js";
import { HandlerError } from "../src/engine/error.js";
import type { VisualDocument } from "../src/types.js";

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

describe("setDocumentThemeEntry.handler", () => {
  it("sets document theme", () => {
    const action = {
      type: "set-document-theme" as const,
      themeId: "theme-dark",
    };
    const result = setDocumentThemeEntry.handler(themedDoc, action, {
      now: Date.now,
    });
    expect(result.activeThemeId).toBe("theme-dark");
  });

  it("clears document theme when themeId is undefined", () => {
    const alreadyThemed: VisualDocument = {
      ...themedDoc,
      activeThemeId: "theme-dark",
    };
    const action = { type: "set-document-theme" as const, themeId: undefined };
    const result = setDocumentThemeEntry.handler(alreadyThemed, action, {
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
      setDocumentThemeEntry.handler(themedDoc, action, { now: Date.now }),
    ).toThrow(HandlerError);
    try {
      setDocumentThemeEntry.handler(themedDoc, action, { now: Date.now });
    } catch (e) {
      expect((e as HandlerError).code).toBe("document.theme-not-found");
    }
  });

  it("allows any themeId when document has no themes array", () => {
    const action = {
      type: "set-document-theme" as const,
      themeId: "any-theme",
    };
    const result = setDocumentThemeEntry.handler(doc, action, {
      now: Date.now,
    });
    expect(result.activeThemeId).toBe("any-theme");
  });
});

describe("setPageThemeEntry.handler", () => {
  it("sets page theme override", () => {
    const action = {
      type: "set-page-theme" as const,
      pageId: "p1",
      themeId: "theme-dark",
    };
    const result = setPageThemeEntry.handler(themedDoc, action, {
      now: Date.now,
    });
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
    const result = setPageThemeEntry.handler(alreadyThemed, action, {
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
    expect(() =>
      setPageThemeEntry.handler(doc, action, { now: Date.now }),
    ).toThrow(HandlerError);
    try {
      setPageThemeEntry.handler(doc, action, { now: Date.now });
    } catch (e) {
      expect((e as HandlerError).code).toBe("document.page-not-found");
    }
  });

  it("rejects unknown themeId when document has themes", () => {
    const action = {
      type: "set-page-theme" as const,
      pageId: "p1",
      themeId: "nonexistent",
    };
    expect(() =>
      setPageThemeEntry.handler(themedDoc, action, { now: Date.now }),
    ).toThrow(HandlerError);
    try {
      setPageThemeEntry.handler(themedDoc, action, { now: Date.now });
    } catch (e) {
      expect((e as HandlerError).code).toBe("document.theme-not-found");
    }
  });

  it("allows any themeId when document has no themes array", () => {
    const action = {
      type: "set-page-theme" as const,
      pageId: "p1",
      themeId: "any-theme",
    };
    const result = setPageThemeEntry.handler(doc, action, { now: Date.now });
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

describe("updatePageRouteEntry.handler", () => {
  it("updates page route", () => {
    const action = {
      type: "update-page-route" as const,
      pageId: "p1",
      route: "/dashboard",
    };
    const result = updatePageRouteEntry.handler(doc, action, { now: Date.now });
    expect(result.pages[0]?.route).toBe("/dashboard");
  });

  it("normalizes the route before storing", () => {
    const action = {
      type: "update-page-route" as const,
      pageId: "p1",
      route: "DASHBOARD",
    };
    const result = updatePageRouteEntry.handler(doc, action, { now: Date.now });
    expect(result.pages[0]?.route).toBe("/dashboard");
  });

  it("rejects when page not found", () => {
    const action = {
      type: "update-page-route" as const,
      pageId: "missing",
      route: "/settings",
    };
    expect(() =>
      updatePageRouteEntry.handler(doc, action, { now: Date.now }),
    ).toThrow(HandlerError);
    try {
      updatePageRouteEntry.handler(doc, action, { now: Date.now });
    } catch (e) {
      expect((e as HandlerError).code).toBe("document.page-not-found");
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
      updatePageRouteEntry.handler(multiDoc, action, { now: Date.now }),
    ).toThrow(HandlerError);
    try {
      updatePageRouteEntry.handler(multiDoc, action, { now: Date.now });
    } catch (e) {
      expect((e as HandlerError).code).toBe("document.duplicate-route");
    }
  });

  it("rejects empty or whitespace-only route", () => {
    const action = {
      type: "update-page-route" as const,
      pageId: "p1",
      route: "   ",
    };
    expect(() =>
      updatePageRouteEntry.handler(doc, action, { now: Date.now }),
    ).toThrow(HandlerError);
    try {
      updatePageRouteEntry.handler(doc, action, { now: Date.now });
    } catch (e) {
      expect((e as HandlerError).code).toBe("document.invalid-route");
    }
  });
});
