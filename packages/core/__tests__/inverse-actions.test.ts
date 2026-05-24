import { describe, expect, it } from "vitest";
import { computeInverseAction } from "../src/document/inverse-registry.js";
import { createDefaultDocumentRegistries } from "../src/document/inverse.js";
import type { InverseRegistry } from "../src/document/inverse.js";
import type { VisualDocument, PersistedSceneGraph } from "../src/types.js";
import type { DocumentAction } from "../src/document/actions.js";
import type { DocumentRuntimeContext } from "../src/document/handler.js";

const { inverseRegistry: defaultInverseRegistry } = createDefaultDocumentRegistries(
  () => ({ ok: true, document: makeDoc() }),
);

const defaultContext: DocumentRuntimeContext = { now: Date.now };

const emptyScene: PersistedSceneGraph = {
  version: 0,
  rootId: "root-1",
  nodes: { "root-1": { id: "root-1", type: "container" } },
};

function makeDoc(overrides?: Partial<VisualDocument>): VisualDocument {
  return {
    id: "doc-1",
    title: "Test",
    pages: [],
    scenes: {},
    ...overrides,
  };
}

const docWithPage: VisualDocument = makeDoc({
  pages: [{ id: "p1", name: "Page 1", sceneId: "s1", route: "/dashboard" }],
  scenes: { s1: emptyScene },
});

const docWithTwoPages: VisualDocument = makeDoc({
  pages: [
    { id: "p1", name: "Page 1", sceneId: "s1", route: "/dashboard" },
    { id: "p2", name: "Page 2", sceneId: "s2", route: "/settings" },
  ],
  scenes: { s1: emptyScene, s2: { ...emptyScene, rootId: "root-2", nodes: { "root-2": { id: "root-2", type: "container" } } } },
});

const docWithTheme: VisualDocument = makeDoc({
  activeThemeId: "theme-dark",
  themes: [
    { id: "theme-dark", name: "Dark", tokens: {} },
    { id: "theme-light", name: "Light", tokens: {} },
  ],
  pages: [{ id: "p1", name: "Page 1", sceneId: "s1", themeId: "theme-dark" }],
  scenes: { s1: emptyScene },
});

describe("computeInverseAction with registry", () => {
  describe("create-page", () => {
    it("computes inverse as remove-page", () => {
      const action: DocumentAction = {
        type: "create-page",
        page: { id: "p1", name: "Page 1", sceneId: "s1" },
        scene: emptyScene,
      };
      const inverse = computeInverseAction(defaultInverseRegistry, docWithPage, action, defaultContext);
      expect(inverse).toEqual({
        type: "remove-page",
        pageId: "p1",
      });
    });

    it("computes inverse even when page not in document yet (forward action)", () => {
      const action: DocumentAction = {
        type: "create-page",
        page: { id: "p1", name: "Page 1", sceneId: "s1" },
        scene: emptyScene,
      };
      const inverse = computeInverseAction(defaultInverseRegistry, makeDoc(), action, defaultContext);
      expect(inverse).toEqual({
        type: "remove-page",
        pageId: "p1",
      });
    });
  });

  describe("rename-page", () => {
    it("computes inverse with old name", () => {
      const action: DocumentAction = {
        type: "rename-page",
        pageId: "p1",
        name: "Renamed",
      };
      const inverse = computeInverseAction(defaultInverseRegistry, docWithPage, action, defaultContext);
      expect(inverse).toEqual({
        type: "rename-page",
        pageId: "p1",
        name: "Page 1",
      });
    });

    it("returns undefined when page not found", () => {
      const action: DocumentAction = {
        type: "rename-page",
        pageId: "missing",
        name: "Nope",
      };
      const inverse = computeInverseAction(defaultInverseRegistry, docWithPage, action, defaultContext);
      expect(inverse).toBeUndefined();
    });
  });

  describe("remove-page", () => {
    it("computes inverse as create-page with saved page and scene", () => {
      const action: DocumentAction = {
        type: "remove-page",
        pageId: "p1",
      };
      const inverse = computeInverseAction(defaultInverseRegistry, docWithPage, action, defaultContext);
      expect(inverse).toEqual({
        type: "create-page",
        page: {
          id: "p1",
          name: "Page 1",
          sceneId: "s1",
          route: "/dashboard",
          themeId: undefined,
          metadata: undefined,
        },
        scene: emptyScene,
      });
    });

    it("returns undefined when page not found", () => {
      const action: DocumentAction = {
        type: "remove-page",
        pageId: "missing",
      };
      const inverse = computeInverseAction(defaultInverseRegistry, makeDoc(), action, defaultContext);
      expect(inverse).toBeUndefined();
    });
  });

  describe("reorder-page", () => {
    it("computes inverse restoring original index", () => {
      const action: DocumentAction = {
        type: "reorder-page",
        pageId: "p1",
        index: 1,
      };
      const inverse = computeInverseAction(defaultInverseRegistry, docWithTwoPages, action, defaultContext);
      expect(inverse).toEqual({
        type: "reorder-page",
        pageId: "p1",
        index: 0,
      });
    });

    it("returns undefined when page not found", () => {
      const action: DocumentAction = {
        type: "reorder-page",
        pageId: "missing",
        index: 0,
      };
      const inverse = computeInverseAction(defaultInverseRegistry, docWithTwoPages, action, defaultContext);
      expect(inverse).toBeUndefined();
    });
  });

  describe("update-page-route", () => {
    it("computes inverse with old route", () => {
      const action: DocumentAction = {
        type: "update-page-route",
        pageId: "p1",
        route: "/new-route",
      };
      const inverse = computeInverseAction(defaultInverseRegistry, docWithPage, action, defaultContext);
      expect(inverse).toEqual({
        type: "update-page-route",
        pageId: "p1",
        route: "/dashboard",
      });
    });

    it("computes inverse with empty string when page has no route", () => {
      const docNoRoute = makeDoc({
        pages: [{ id: "p1", name: "Page 1", sceneId: "s1" }],
        scenes: { s1: emptyScene },
      });
      const action: DocumentAction = {
        type: "update-page-route",
        pageId: "p1",
        route: "/dashboard",
      };
      const inverse = computeInverseAction(defaultInverseRegistry, docNoRoute, action, defaultContext);
      expect(inverse).toEqual({
        type: "update-page-route",
        pageId: "p1",
        route: "",
      });
    });

    it("returns undefined when page not found", () => {
      const action: DocumentAction = {
        type: "update-page-route",
        pageId: "missing",
        route: "/settings",
      };
      const inverse = computeInverseAction(defaultInverseRegistry, docWithPage, action, defaultContext);
      expect(inverse).toBeUndefined();
    });
  });

  describe("set-document-theme", () => {
    it("computes inverse restoring previous themeId", () => {
      const action: DocumentAction = {
        type: "set-document-theme",
        themeId: "theme-light",
      };
      const inverse = computeInverseAction(defaultInverseRegistry, docWithTheme, action, defaultContext);
      expect(inverse).toEqual({
        type: "set-document-theme",
        themeId: "theme-dark",
      });
    });

    it("computes inverse clearing theme when document has no activeThemeId", () => {
      const docNoTheme = makeDoc({
        pages: [{ id: "p1", name: "Page 1", sceneId: "s1" }],
        scenes: { s1: emptyScene },
      });
      const action: DocumentAction = {
        type: "set-document-theme",
        themeId: "theme-dark",
      };
      const inverse = computeInverseAction(defaultInverseRegistry, docNoTheme, action, defaultContext);
      expect(inverse).toEqual({
        type: "set-document-theme",
        themeId: undefined,
      });
    });
  });

  describe("set-page-theme", () => {
    it("computes inverse restoring previous page themeId", () => {
      const action: DocumentAction = {
        type: "set-page-theme",
        pageId: "p1",
        themeId: "theme-light",
      };
      const inverse = computeInverseAction(defaultInverseRegistry, docWithTheme, action, defaultContext);
      expect(inverse).toEqual({
        type: "set-page-theme",
        pageId: "p1",
        themeId: "theme-dark",
      });
    });

    it("returns undefined when page not found", () => {
      const action: DocumentAction = {
        type: "set-page-theme",
        pageId: "missing",
        themeId: "theme-dark",
      };
      const inverse = computeInverseAction(defaultInverseRegistry, docWithTheme, action, defaultContext);
      expect(inverse).toBeUndefined();
    });
  });

  describe("batch-document-actions", () => {
    it("batch inverse returns undefined (not yet supported at registry level)", () => {
      const action: DocumentAction = {
        type: "batch-document-actions",
        actions: [
          { type: "rename-page", pageId: "p1", name: "New Name" },
        ],
      };
      const inverse = computeInverseAction(
        defaultInverseRegistry,
        docWithPage,
        action,
        defaultContext,
      );
      expect(inverse).toBeUndefined();
    });
  });

  describe("unknown action type", () => {
    it("returns undefined for unregistered action type", () => {
      const emptyRegistry: InverseRegistry = new Map();
      const action = { type: "unknown-action" } as unknown as DocumentAction;
      const inverse = computeInverseAction(emptyRegistry, makeDoc(), action, defaultContext);
      expect(inverse).toBeUndefined();
    });
  });
});