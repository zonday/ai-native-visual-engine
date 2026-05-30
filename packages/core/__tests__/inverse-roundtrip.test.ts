import { describe, expect, it } from "vitest";
import type { DocumentRuntimeContext } from "../src/document/handler-registry.js";
import type { DocumentAction } from "../src/document/register-handlers.js";
import { createDocumentRegistry } from "../src/document/register-handlers.js";
import type { ActionRegistry } from "../src/engine/action-registry.js";
import type { VisualDocument } from "../src/types.js";
import { emptyPersistedScene, makeDoc } from "./helpers.js";

const context: DocumentRuntimeContext = { now: Date.now };

function applyAction(
  registry: ActionRegistry<
    DocumentAction,
    VisualDocument,
    DocumentRuntimeContext
  >,
  doc: VisualDocument,
  action: DocumentAction,
): VisualDocument {
  const handler = registry.getHandler(action.type);
  if (!handler) throw new Error(`No handler for ${action.type}`);
  return handler(doc, action, context);
}

describe("inverse round-trip — action → inverse restores state", () => {
  it("create-page → remove-page (inverse) restores original state", () => {
    const docReg = createDocumentRegistry();

    const doc1 = applyAction(docReg, makeDoc(), {
      type: "create-page",
      page: { id: "p1", name: "Page 1", sceneId: "s1" },
      scene: emptyPersistedScene,
    });
    expect(doc1.pages).toHaveLength(1);

    const inverse = docReg.getInverse("create-page")?.(
      makeDoc(),
      {
        type: "create-page",
        page: { id: "p1", name: "Page 1", sceneId: "s1" },
        scene: emptyPersistedScene,
      },
      context,
    );
    expect(inverse).toBeDefined();

    const doc2 = applyAction(docReg, doc1, inverse as DocumentAction);
    expect(doc2.pages).toHaveLength(0);
    expect(doc2.scenes.s1).toBeUndefined();
  });

  it("remove-page → create-page (inverse) restores original state", () => {
    const docReg = createDocumentRegistry();

    const docWithPage: VisualDocument = makeDoc({
      pages: [{ id: "p1", name: "Page 1", sceneId: "s1", route: "/dashboard" }],
      scenes: { s1: emptyPersistedScene },
    });

    const doc1 = applyAction(docReg, docWithPage, {
      type: "remove-page",
      pageId: "p1",
    });
    expect(doc1.pages).toHaveLength(0);

    const inverse = docReg.getInverse("remove-page")?.(
      docWithPage,
      {
        type: "remove-page",
        pageId: "p1",
      },
      context,
    );
    expect(inverse).toBeDefined();

    const doc2 = applyAction(docReg, doc1, inverse as DocumentAction);
    expect(doc2.pages).toHaveLength(1);
    expect(doc2.pages[0]?.id).toBe("p1");
    expect(doc2.pages[0]?.name).toBe("Page 1");
    expect(doc2.pages[0]?.route).toBe("/dashboard");
    expect(doc2.scenes.s1).toBe(emptyPersistedScene);
  });

  it("rename-page → rename-page (inverse) restores original name", () => {
    const docReg = createDocumentRegistry();

    const docWithPage: VisualDocument = makeDoc({
      pages: [{ id: "p1", name: "Page 1", sceneId: "s1" }],
      scenes: { s1: emptyPersistedScene },
    });

    const doc1 = applyAction(docReg, docWithPage, {
      type: "rename-page",
      pageId: "p1",
      name: "Renamed",
    });
    expect(doc1.pages[0]?.name).toBe("Renamed");

    const inverse = docReg.getInverse("rename-page")?.(
      docWithPage,
      {
        type: "rename-page",
        pageId: "p1",
        name: "Renamed",
      },
      context,
    );
    expect(inverse).toEqual({
      type: "rename-page",
      pageId: "p1",
      name: "Page 1",
    });

    const doc2 = applyAction(docReg, doc1, inverse as DocumentAction);
    expect(doc2.pages[0]?.name).toBe("Page 1");
  });

  it("reorder-page → reorder-page (inverse) restores original order", () => {
    const docReg = createDocumentRegistry();

    const docWithTwoPages: VisualDocument = makeDoc({
      pages: [
        { id: "p1", name: "Page 1", sceneId: "s1" },
        { id: "p2", name: "Page 2", sceneId: "s2" },
      ],
      scenes: {
        s1: emptyPersistedScene,
        s2: {
          ...emptyPersistedScene,
          rootId: "root-2",
          nodes: { "root-2": { id: "root-2", type: "container" } },
        },
      },
    });

    const doc1 = applyAction(docReg, docWithTwoPages, {
      type: "reorder-page",
      pageId: "p1",
      index: 1,
    });
    expect(doc1.pages[1]?.id).toBe("p1");

    const inverse = docReg.getInverse("reorder-page")?.(
      docWithTwoPages,
      {
        type: "reorder-page",
        pageId: "p1",
        index: 1,
      },
      context,
    );
    expect(inverse).toEqual({ type: "reorder-page", pageId: "p1", index: 0 });

    const doc2 = applyAction(docReg, doc1, inverse as DocumentAction);
    expect(doc2.pages[0]?.id).toBe("p1");
    expect(doc2.pages[1]?.id).toBe("p2");
  });

  it("update-page-route → update-page-route (inverse) restores original route", () => {
    const docReg = createDocumentRegistry();

    const docWithPage: VisualDocument = makeDoc({
      pages: [{ id: "p1", name: "Page 1", sceneId: "s1", route: "/original" }],
      scenes: { s1: emptyPersistedScene },
    });

    const doc1 = applyAction(docReg, docWithPage, {
      type: "update-page-route",
      pageId: "p1",
      route: "/new-route",
    });
    expect(doc1.pages[0]?.route).toBe("/new-route");

    const inverse = docReg.getInverse("update-page-route")?.(
      docWithPage,
      {
        type: "update-page-route",
        pageId: "p1",
        route: "/new-route",
      },
      context,
    );
    expect(inverse).toEqual({
      type: "update-page-route",
      pageId: "p1",
      route: "/original",
    });

    const doc2 = applyAction(docReg, doc1, inverse as DocumentAction);
    expect(doc2.pages[0]?.route).toBe("/original");
  });

  it("set-document-theme → set-document-theme (inverse) restores original activeThemeId", () => {
    const docReg = createDocumentRegistry();

    const docWithTheme: VisualDocument = makeDoc({
      activeThemeId: "theme-dark",
      themes: [
        { id: "theme-dark", name: "Dark", tokens: {} },
        { id: "theme-light", name: "Light", tokens: {} },
      ],
      pages: [{ id: "p1", name: "Page 1", sceneId: "s1" }],
      scenes: { s1: emptyPersistedScene },
    });

    const doc1 = applyAction(docReg, docWithTheme, {
      type: "set-document-theme",
      themeId: "theme-light",
    });
    expect(doc1.activeThemeId).toBe("theme-light");

    const inverse = docReg.getInverse("set-document-theme")?.(
      docWithTheme,
      {
        type: "set-document-theme",
        themeId: "theme-light",
      },
      context,
    );
    expect(inverse).toEqual({
      type: "set-document-theme",
      themeId: "theme-dark",
    });

    const doc2 = applyAction(docReg, doc1, inverse as DocumentAction);
    expect(doc2.activeThemeId).toBe("theme-dark");
  });

  it("set-page-theme → set-page-theme (inverse) restores original page themeId", () => {
    const docReg = createDocumentRegistry();

    const docWithTheme: VisualDocument = makeDoc({
      themes: [
        { id: "theme-dark", name: "Dark", tokens: {} },
        { id: "theme-light", name: "Light", tokens: {} },
      ],
      pages: [
        { id: "p1", name: "Page 1", sceneId: "s1", themeId: "theme-dark" },
      ],
      scenes: { s1: emptyPersistedScene },
    });

    const doc1 = applyAction(docReg, docWithTheme, {
      type: "set-page-theme",
      pageId: "p1",
      themeId: "theme-light",
    });
    expect(doc1.pages[0]?.themeId).toBe("theme-light");

    const inverse = docReg.getInverse("set-page-theme")?.(
      docWithTheme,
      {
        type: "set-page-theme",
        pageId: "p1",
        themeId: "theme-light",
      },
      context,
    );
    expect(inverse).toEqual({
      type: "set-page-theme",
      pageId: "p1",
      themeId: "theme-dark",
    });

    const doc2 = applyAction(docReg, doc1, inverse as DocumentAction);
    expect(doc2.pages[0]?.themeId).toBe("theme-dark");
  });
});
