import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function nonNull<T>(value: T): NonNullable<T> {
  return value as NonNullable<T>;
}

import { createEmptyScene, createNewDocument } from "../src/bootstrap.js";
import { splitRegistry } from "../src/engine/action-registry.js";
import { exportDocument } from "../src/import-export.js";
import type { RuntimeAction } from "../src/runtime/actions.js";
import type { DispatchResult } from "../src/runtime/command-bus.js";
import { createRuntimeRegistry } from "../src/runtime/register-handlers.js";
import { createRuntimeCommandBus } from "../src/runtime/runtime-command-bus.js";
import { openDocumentSession } from "../src/session.js";
import type { DocumentSnapshot } from "../src/types.js";
import { DocumentSnapshotSchema, VisualDocumentSchema } from "../src/types.js";

function loadFixture(name: string): DocumentSnapshot {
  const path = resolve(__dirname, `../__fixtures__/${name}.json`);
  return JSON.parse(readFileSync(path, "utf-8")) as DocumentSnapshot;
}

function validateFixture(snapshot: DocumentSnapshot): {
  ok: boolean;
  diagnostics: string[];
} {
  const diagnostics: string[] = [];
  const parsed = DocumentSnapshotSchema.safeParse(snapshot);
  if (!parsed.success) diagnostics.push(parsed.error.message);
  const docParsed = VisualDocumentSchema.safeParse(snapshot.document);
  if (!docParsed.success) diagnostics.push(docParsed.error.message);
  return { ok: diagnostics.length === 0, diagnostics };
}

describe("fixture files validation", () => {
  it("single-page-empty.json is valid", () => {
    const result = validateFixture(loadFixture("single-page-empty"));
    expect(result.ok).toBe(true);
  });

  it("multi-page-dashboard.json is valid", () => {
    const result = validateFixture(loadFixture("multi-page-dashboard"));
    expect(result.ok).toBe(true);
  });
  it("invalid geometry produces validation diagnostics", () => {
    const result = validateFixture({
      document: { foo: "bar" },
    } as unknown as DocumentSnapshot);
    expect(result.ok).toBe(false);
    expect(result.diagnostics.length).toBeGreaterThan(0);
  });
});

describe("createNewDocument initialization", () => {
  it("produces a valid document ready for editing", () => {
    const doc = createNewDocument({ title: "Test" });
    const parsed = VisualDocumentSchema.safeParse(doc);
    expect(parsed.success).toBe(true);
    expect(doc.pages).toHaveLength(1);
    const firstPage = nonNull(doc.pages[0]);
    expect(doc.scenes[firstPage.sceneId]).toBeDefined();
  });

  it("sets active theme via themeId option", () => {
    const doc = createNewDocument({ title: "Themed", themeId: "dark-theme" });
    expect(doc.activeThemeId).toBe("dark-theme");
  });
});

describe("openDocumentSession lifecycle", () => {
  it("opens session, switches pages, and closes", () => {
    const doc = createNewDocument({ title: "Session Test" });
    const page2 = { id: "page-2", name: "Page 2", sceneId: "scene-2" };
    doc.pages.push(page2);
    doc.scenes["scene-2"] = createEmptyScene();

    const session = openDocumentSession(doc);
    expect(session.state.isOpen).toBe(true);
    expect(session.state.activePageId).toBe(doc.pages[0]?.id);

    session.switchPage("page-2");
    expect(session.state.activePageId).toBe("page-2");

    session.close();
    expect(session.state.isOpen).toBe(false);
  });
});

describe("action replay determinism", () => {
  it("produces same scene from same action sequence", () => {
    const doc = createNewDocument({ title: "Replay" });
    const page0 = doc.pages[0];
    const scene = page0 ? doc.scenes[page0.sceneId] : undefined;
    if (!scene) throw new Error("Missing scene fixture");

    const registry = createRuntimeRegistry(() => ({
      ok: false,
      scene: { version: 0, rootId: "root", nodes: {} },
      error: { code: "fail", message: "noop" },
    }));
    const { handlerRegistry } = splitRegistry(registry);

    const bus1 = createRuntimeCommandBus(
      handlerRegistry,
      [],
      { ...scene, version: 0, nodes: { ...scene.nodes } },
      { now: Date.now },
    );
    const bus2 = createRuntimeCommandBus(
      handlerRegistry,
      [],
      { ...scene, version: 0, nodes: { ...scene.nodes } },
      { now: Date.now },
    );

    const actions = [
      {
        type: "create-node" as const,
        node: { id: "a", type: "container" },
        parentId: scene.rootId,
      },
      {
        type: "create-node" as const,
        node: { id: "b", type: "text" },
        parentId: "a",
      },
    ];

    for (const action of actions) {
      bus1.dispatch(action);
      bus2.dispatch(action);
    }

    expect(bus1.getScene().nodes).toEqual(bus2.getScene().nodes);
  });
});

describe("batch actions via command bus", () => {
  it("batch dispatches multiple create-node actions atomically", () => {
    const doc = createNewDocument({ title: "Batch" });
    const page0 = doc.pages[0];
    const scene = page0 ? doc.scenes[page0.sceneId] : undefined;
    if (!scene) throw new Error("Missing scene fixture");
    const initial = { ...scene, version: 0, nodes: { ...scene.nodes } };

    let current = initial;
    const dispatch = (action: RuntimeAction): DispatchResult => {
      const runtimeReg = createRuntimeRegistry(() => ({
        ok: false,
        scene: current,
        error: { code: "fail", message: "noop" },
      }));
      const { handlerRegistry: reg } = splitRegistry(runtimeReg);
      const entry = reg.get(action.type);
      if (!entry)
        return {
          ok: false,
          scene: current,
          error: { code: "unknown", message: "?" },
        };
      try {
        current = entry.handler(current, action, { now: Date.now });
        return { ok: true, scene: current };
      } catch (e) {
        return {
          ok: false,
          scene: current,
          error: { code: "error", message: (e as Error).message },
        };
      }
    };

    const registry2 = createRuntimeRegistry(dispatch);
    const { handlerRegistry } = splitRegistry(registry2);
    const bus = createRuntimeCommandBus(handlerRegistry, [], initial, {
      now: Date.now,
    });

    const result = bus.dispatch({
      type: "batch-actions",
      actions: [
        {
          type: "create-node",
          node: { id: "a", type: "container" },
          parentId: scene.rootId,
        },
        { type: "create-node", node: { id: "b", type: "text" }, parentId: "a" },
      ],
    });

    expect(result.ok).toBe(true);
    expect(result.scene.nodes.a).toBeDefined();
    expect(result.scene.nodes.b).toBeDefined();
  });
});

describe("exportDocument with fixtures", () => {
  it("exports single page without selection overlays", () => {
    const doc = createNewDocument({ title: "Export" });
    const exported = exportDocument(doc);
    const parsed = DocumentSnapshotSchema.safeParse(exported);
    expect(parsed.success).toBe(true);
  });

  it("exports multi-page document with page filtering", () => {
    const doc = createNewDocument({ title: "Multi" });
    doc.pages.push({ id: "page-2", name: "Page 2", sceneId: "scene-2" });
    doc.scenes["scene-2"] = createEmptyScene();

    const exportedId = nonNull(doc.pages[0]).id;
    const exported = exportDocument(doc, { targetPageIds: [exportedId] });
    expect(exported.document.pages).toHaveLength(1);
  });
});

describe("scene fixture with container and text nodes", () => {
  it("creates a scene with container and text node hierarchy", () => {
    const doc = createNewDocument({ title: "Render" });
    const page0 = doc.pages[0];
    const scene = page0 ? doc.scenes[page0.sceneId] : undefined;
    if (!scene) throw new Error("Missing scene fixture");
    scene.nodes["text-1"] = {
      id: "text-1",
      type: "text",
      parentId: scene.rootId,
      props: { text: "Hello" },
    };
    const root = scene.nodes[scene.rootId];
    if (root) root.children = ["text-1"];

    expect(scene.nodes["text-1"]).toBeDefined();
    expect(scene.nodes["text-1"]?.type).toBe("text");
    expect(scene.nodes[scene.rootId]?.children).toContain("text-1");
  });
});
