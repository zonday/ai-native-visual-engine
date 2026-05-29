import { describe, expect, it } from "vitest";
import type { DocumentAction } from "../src/document/actions.js";
import type { DocumentDispatchResult } from "../src/document/command-bus.js";
import type { DocumentRuntimeContext } from "../src/document/handler.js";
import { createDefaultDocumentRegistries } from "../src/document/inverse.js";
import type { VisualDocument } from "../src/types.js";
import { emptyPersistedScene, makeDoc } from "./helpers.js";

const context: DocumentRuntimeContext = { now: Date.now };

function applyAction(
  registries: ReturnType<typeof createDefaultDocumentRegistries>,
  doc: VisualDocument,
  action: DocumentAction,
): VisualDocument {
  const entry = registries.handlerRegistry.get(action.type);
  if (!entry) throw new Error(`No handler for ${action.type}`);
  return entry.handler(doc, action, context);
}

describe("inverse round-trip — action → inverse restores state", () => {
  it("create-page → remove-page (inverse) restores original state", () => {
    const registries = createDefaultDocumentRegistries(
      () => ({ ok: true, document: makeDoc() }) as DocumentDispatchResult,
    );

    const doc1 = applyAction(registries, makeDoc(), {
      type: "create-page",
      page: { id: "p1", name: "Page 1", sceneId: "s1" },
      scene: emptyPersistedScene,
    });
    expect(doc1.pages).toHaveLength(1);

    const inverse = registries.inverseRegistry.get("create-page")?.(
      makeDoc(),
      {
        type: "create-page",
        page: { id: "p1", name: "Page 1", sceneId: "s1" },
        scene: emptyPersistedScene,
      },
      context,
    );
    expect(inverse).toBeDefined();

    const doc2 = applyAction(registries, doc1, inverse as DocumentAction);
    expect(doc2.pages).toHaveLength(0);
    expect(doc2.scenes.s1).toBeUndefined();
  });

  it("remove-page → create-page (inverse) restores original state", () => {
    const registries = createDefaultDocumentRegistries(
      () => ({ ok: true, document: makeDoc() }) as DocumentDispatchResult,
    );

    const docWithPage: VisualDocument = makeDoc({
      pages: [{ id: "p1", name: "Page 1", sceneId: "s1", route: "/dashboard" }],
      scenes: { s1: emptyPersistedScene },
    });

    const doc1 = applyAction(registries, docWithPage, {
      type: "remove-page",
      pageId: "p1",
    });
    expect(doc1.pages).toHaveLength(0);

    const inverse = registries.inverseRegistry.get("remove-page")?.(
      docWithPage,
      {
        type: "remove-page",
        pageId: "p1",
      },
      context,
    );
    expect(inverse).toBeDefined();

    const doc2 = applyAction(registries, doc1, inverse as DocumentAction);
    expect(doc2.pages).toHaveLength(1);
    expect(doc2.pages[0]?.id).toBe("p1");
    expect(doc2.pages[0]?.name).toBe("Page 1");
    expect(doc2.pages[0]?.route).toBe("/dashboard");
    expect(doc2.scenes.s1).toBe(emptyPersistedScene);
  });

  it("rename-page → rename-page (inverse) restores original name", () => {
    const registries = createDefaultDocumentRegistries(
      () => ({ ok: true, document: makeDoc() }) as DocumentDispatchResult,
    );

    const docWithPage: VisualDocument = makeDoc({
      pages: [{ id: "p1", name: "Page 1", sceneId: "s1" }],
      scenes: { s1: emptyPersistedScene },
    });

    const doc1 = applyAction(registries, docWithPage, {
      type: "rename-page",
      pageId: "p1",
      name: "Renamed",
    });
    expect(doc1.pages[0]?.name).toBe("Renamed");

    const inverse = registries.inverseRegistry.get("rename-page")?.(
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

    const doc2 = applyAction(registries, doc1, inverse as DocumentAction);
    expect(doc2.pages[0]?.name).toBe("Page 1");
  });

  it("reorder-page → reorder-page (inverse) restores original order", () => {
    const registries = createDefaultDocumentRegistries(
      () => ({ ok: true, document: makeDoc() }) as DocumentDispatchResult,
    );

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

    const doc1 = applyAction(registries, docWithTwoPages, {
      type: "reorder-page",
      pageId: "p1",
      index: 1,
    });
    expect(doc1.pages[1]?.id).toBe("p1");

    const inverse = registries.inverseRegistry.get("reorder-page")?.(
      docWithTwoPages,
      {
        type: "reorder-page",
        pageId: "p1",
        index: 1,
      },
      context,
    );
    expect(inverse).toEqual({ type: "reorder-page", pageId: "p1", index: 0 });

    const doc2 = applyAction(registries, doc1, inverse as DocumentAction);
    expect(doc2.pages[0]?.id).toBe("p1");
    expect(doc2.pages[1]?.id).toBe("p2");
  });

  it("update-page-route → update-page-route (inverse) restores original route", () => {
    const registries = createDefaultDocumentRegistries(
      () => ({ ok: true, document: makeDoc() }) as DocumentDispatchResult,
    );

    const docWithPage: VisualDocument = makeDoc({
      pages: [{ id: "p1", name: "Page 1", sceneId: "s1", route: "/original" }],
      scenes: { s1: emptyPersistedScene },
    });

    const doc1 = applyAction(registries, docWithPage, {
      type: "update-page-route",
      pageId: "p1",
      route: "/new-route",
    });
    expect(doc1.pages[0]?.route).toBe("/new-route");

    const inverse = registries.inverseRegistry.get("update-page-route")?.(
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

    const doc2 = applyAction(registries, doc1, inverse as DocumentAction);
    expect(doc2.pages[0]?.route).toBe("/original");
  });

  it("set-document-theme → set-document-theme (inverse) restores original activeThemeId", () => {
    const registries = createDefaultDocumentRegistries(
      () => ({ ok: true, document: makeDoc() }) as DocumentDispatchResult,
    );

    const docWithTheme: VisualDocument = makeDoc({
      activeThemeId: "theme-dark",
      themes: [
        { id: "theme-dark", name: "Dark", tokens: {} },
        { id: "theme-light", name: "Light", tokens: {} },
      ],
      pages: [{ id: "p1", name: "Page 1", sceneId: "s1" }],
      scenes: { s1: emptyPersistedScene },
    });

    const doc1 = applyAction(registries, docWithTheme, {
      type: "set-document-theme",
      themeId: "theme-light",
    });
    expect(doc1.activeThemeId).toBe("theme-light");

    const inverse = registries.inverseRegistry.get("set-document-theme")?.(
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

    const doc2 = applyAction(registries, doc1, inverse as DocumentAction);
    expect(doc2.activeThemeId).toBe("theme-dark");
  });

  it("set-page-theme → set-page-theme (inverse) restores original page themeId", () => {
    const registries = createDefaultDocumentRegistries(
      () => ({ ok: true, document: makeDoc() }) as DocumentDispatchResult,
    );

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

    const doc1 = applyAction(registries, docWithTheme, {
      type: "set-page-theme",
      pageId: "p1",
      themeId: "theme-light",
    });
    expect(doc1.pages[0]?.themeId).toBe("theme-light");

    const inverse = registries.inverseRegistry.get("set-page-theme")?.(
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

    const doc2 = applyAction(registries, doc1, inverse as DocumentAction);
    expect(doc2.pages[0]?.themeId).toBe("theme-dark");
  });
});
