import { describe, it, expect } from "vitest";
import type { VisualDocument } from "../src/types.js";
import { createNewDocument } from "../src/bootstrap.js";
import {
  openDocumentSession,
  materializeScene,
  SessionError,
} from "../src/session.js";

describe("openDocumentSession", () => {
  it("opens a session and returns the active scene", () => {
    const doc = createNewDocument({ title: "Test" });
    const session = openDocumentSession(doc);
    expect(session.state.isOpen).toBe(true);
    expect(session.state.activePageId).toBe(doc.pages[0]!.id);
    const scene = session.getActiveScene();
    expect(scene.rootId).toBeDefined();
    expect(scene.version).toBe(0);
    expect(scene.selection).toBeUndefined();
    expect(scene.viewport).toBeUndefined();
  });

  it("opens a session with a specified active page", () => {
    const doc = createNewDocument({ title: "Test" });
    const session = openDocumentSession(doc, doc.pages[0]!.id);
    expect(session.state.activePageId).toBe(doc.pages[0]!.id);
  });

  it("throws when the document has no pages", () => {
    const doc: VisualDocument = {
      id: "empty",
      title: "Empty",
      pages: [],
      scenes: {},
    };
    expect(() => openDocumentSession(doc)).toThrow(SessionError);
    try {
      openDocumentSession(doc);
    } catch (e) {
      expect((e as SessionError).code).toBe("session.no-pages");
    }
  });

  it("throws when the specified pageId does not exist", () => {
    const doc = createNewDocument();
    expect(() => openDocumentSession(doc, "nonexistent")).toThrow(SessionError);
    try {
      openDocumentSession(doc, "nonexistent");
    } catch (e) {
      expect((e as SessionError).code).toBe("session.page-not-found");
    }
  });
});

describe("session page switching", () => {
  it("switches the active page", () => {
    const doc = createNewDocument({ title: "Page 1" });
    const page2 = {
      id: "page-2",
      name: "Page 2",
      sceneId: "scene-2",
    };
    doc.pages.push(page2);
    doc.scenes["scene-2"] = {
      version: 0,
      rootId: "root-2",
      nodes: { "root-2": { id: "root-2", type: "container", children: [] } },
    };

    const session = openDocumentSession(doc);
    expect(session.state.activePageId).toBe(doc.pages[0]!.id);

    session.switchPage("page-2");
    expect(session.state.activePageId).toBe("page-2");
  });

  it("throws when switching to a non-existent page", () => {
    const doc = createNewDocument();
    const session = openDocumentSession(doc);
    expect(() => session.switchPage("missing")).toThrow(SessionError);
  });

  it("throws getActiveScene when session is closed", () => {
    const doc = createNewDocument();
    const session = openDocumentSession(doc);
    session.close();
    expect(() => session.getActiveScene()).toThrow(SessionError);
  });

  it("throws switchPage when session is closed", () => {
    const doc = createNewDocument();
    const page2 = {
      id: "page-2",
      name: "Page 2",
      sceneId: "scene-2",
    };
    doc.pages.push(page2);
    doc.scenes["scene-2"] = {
      version: 0,
      rootId: "root-2",
      nodes: { "root-2": { id: "root-2", type: "container", children: [] } },
    };

    const session = openDocumentSession(doc);
    session.close();
    expect(() => session.switchPage("page-2")).toThrow(SessionError);
  });
});

describe("materializeScene", () => {
  it("converts PersistedSceneGraph to SceneGraph with empty session state", () => {
    const persisted = {
      version: 5,
      rootId: "r",
      nodes: { r: { id: "r", type: "container", children: ["a"] }, a: { id: "a", type: "text", parentId: "r" } },
    };
    const scene = materializeScene(persisted);
    expect(scene.version).toBe(5);
    expect(scene.rootId).toBe("r");
    expect(scene.nodes["r"]).toBeDefined();
    expect(scene.nodes["a"]).toBeDefined();
    expect(scene.selection).toBeUndefined();
    expect(scene.viewport).toBeUndefined();
  });
});
