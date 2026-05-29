import type { Patch } from "immer";
import { describe, expect, it, vi } from "vitest";
import { produceScene, routeImmerPatches } from "../src/immer-patch-router.js";
import { createSelectorRegistry } from "../src/selector/selector-registry.js";

function makeScene() {
  return {
    version: 0,
    rootId: "root",
    nodes: {
      root: { id: "root", type: "container", children: ["a", "b"] },
      a: { id: "a", type: "text", parentId: "root" },
      b: { id: "b", type: "text", parentId: "root" },
    },
  };
}

describe("routeImmerPatches", () => {
  it("routes replace of layout field to set-prop", () => {
    const sel = createSelectorRegistry(makeScene());
    const spy = vi.spyOn(sel, "applyPatch");
    const patches: Patch[] = [
      {
        op: "replace",
        path: ["nodes", "a", "layout"],
        value: { x: 200 },
      },
    ];
    routeImmerPatches(patches, sel);
    expect(spy).toHaveBeenCalledWith({
      type: "set-prop",
      nodeId: "a",
      field: "layout",
    });
  });

  it("routes replace of parentId to parent field", () => {
    const sel = createSelectorRegistry(makeScene());
    const spy = vi.spyOn(sel, "applyPatch");
    const patches: Patch[] = [
      { op: "replace", path: ["nodes", "a", "parentId"], value: "root" },
    ];
    routeImmerPatches(patches, sel);
    expect(spy).toHaveBeenCalledWith({
      type: "set-prop",
      nodeId: "a",
      field: "parent",
    });
  });

  it("routes replace of children to children field", () => {
    const sel = createSelectorRegistry(makeScene());
    const spy = vi.spyOn(sel, "applyPatch");
    const patches: Patch[] = [
      { op: "replace", path: ["nodes", "a", "children"], value: ["c"] },
    ];
    routeImmerPatches(patches, sel);
    expect(spy).toHaveBeenCalledWith({
      type: "set-prop",
      nodeId: "a",
      field: "children",
    });
  });

  it("routes replace of visible to visible field", () => {
    const sel = createSelectorRegistry(makeScene());
    const spy = vi.spyOn(sel, "applyPatch");
    const patches: Patch[] = [
      { op: "replace", path: ["nodes", "a", "visible"], value: false },
    ];
    routeImmerPatches(patches, sel);
    expect(spy).toHaveBeenCalledWith({
      type: "set-prop",
      nodeId: "a",
      field: "visible",
    });
  });

  it("routes replace of props to props field", () => {
    const sel = createSelectorRegistry(makeScene());
    const spy = vi.spyOn(sel, "applyPatch");
    const patches: Patch[] = [
      {
        op: "replace",
        path: ["nodes", "a", "props"],
        value: { text: "hello" },
      },
    ];
    routeImmerPatches(patches, sel);
    expect(spy).toHaveBeenCalledWith({
      type: "set-prop",
      nodeId: "a",
      field: "props",
    });
  });

  it("routes add node to add-node", () => {
    const sel = createSelectorRegistry(makeScene());
    const spy = vi.spyOn(sel, "applyPatch");
    const patches: Patch[] = [
      {
        op: "add",
        path: ["nodes", "c"],
        value: { id: "c", type: "text", parentId: "root" },
      },
    ];
    routeImmerPatches(patches, sel);
    expect(spy).toHaveBeenCalledWith({
      type: "add-node",
      nodeId: "c",
    });
  });

  it("routes remove node to remove-node", () => {
    const sel = createSelectorRegistry(makeScene());
    const spy = vi.spyOn(sel, "applyPatch");
    const patches: Patch[] = [{ op: "remove", path: ["nodes", "b"] }];
    routeImmerPatches(patches, sel);
    expect(spy).toHaveBeenCalledWith({
      type: "remove-node",
      nodeId: "b",
    });
  });

  it("skips non-node patches (version, rootId, etc)", () => {
    const sel = createSelectorRegistry(makeScene());
    const spy = vi.spyOn(sel, "applyPatch");
    const patches: Patch[] = [
      { op: "replace", path: ["version"], value: 1 },
      { op: "replace", path: ["rootId"], value: "root" },
      { op: "replace", path: ["metadata", "title"], value: "test" },
    ];
    routeImmerPatches(patches, sel);
    expect(spy).not.toHaveBeenCalled();
  });

  it("skips unknown node fields (style, name, runtime)", () => {
    const sel = createSelectorRegistry(makeScene());
    const spy = vi.spyOn(sel, "applyPatch");
    const patches: Patch[] = [
      { op: "replace", path: ["nodes", "a", "style"], value: { color: "red" } },
      { op: "replace", path: ["nodes", "a", "name"], value: "new name" },
    ];
    routeImmerPatches(patches, sel);
    expect(spy).not.toHaveBeenCalled();
  });

  it("routes multiple patches in batch order", () => {
    const sel = createSelectorRegistry(makeScene());
    const spy = vi.spyOn(sel, "applyPatch");
    const patches: Patch[] = [
      { op: "replace", path: ["nodes", "a", "layout"], value: { x: 200 } },
      { op: "replace", path: ["nodes", "b", "visible"], value: false },
    ];
    routeImmerPatches(patches, sel);
    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy).toHaveBeenNthCalledWith(1, {
      type: "set-prop",
      nodeId: "a",
      field: "layout",
    });
    expect(spy).toHaveBeenNthCalledWith(2, {
      type: "set-prop",
      nodeId: "b",
      field: "visible",
    });
  });

  describe("produceScene + handleSceneUpdate + routeImmerPatches (e2e)", () => {
    it("mutates layout field — selector reads updated value", () => {
      const scene = makeScene();
      const sel = createSelectorRegistry(scene);
      const before = sel.getNodeLayout("a");
      expect(before).toBeUndefined();

      const [next, patches] = produceScene(scene, (draft) => {
        draft.nodes.a!.layout = { mode: "absolute", x: 100, y: 50 };
      });
      sel.handleSceneUpdate(next);
      routeImmerPatches(patches, sel);

      const after = sel.getNodeLayout("a");
      expect(after?.x).toBe(100);
    });

    it("mutates visible field — getVisibleNodes reflects change", () => {
      const scene = makeScene();
      const sel = createSelectorRegistry(scene);

      const [next, patches] = produceScene(scene, (draft) => {
        draft.nodes.b!.visible = false;
      });
      sel.handleSceneUpdate(next);
      routeImmerPatches(patches, sel);

      const visible = sel.getVisibleNodes();
      expect(visible.find((n) => n.id === "b")).toBeUndefined();
    });

    it("adds a new node — getAllNodes count increases", () => {
      const scene = makeScene();
      const sel = createSelectorRegistry(scene);
      const before = sel.getAllNodes().length;

      const [next, patches] = produceScene(scene, (draft) => {
        draft.nodes.c = { id: "c", type: "text", parentId: "root" };
        draft.nodes.root!.children = [
          ...(draft.nodes.root!.children ?? []),
          "c",
        ];
      });
      sel.handleSceneUpdate(next);
      routeImmerPatches(patches, sel);

      expect(sel.getAllNodes()).toHaveLength(before + 1);
    });

    it("removes a node — getAllNodes count decreases", () => {
      const scene = makeScene();
      const sel = createSelectorRegistry(scene);
      const before = sel.getAllNodes().length;

      const [next, patches] = produceScene(scene, (draft) => {
        delete draft.nodes.b;
      });
      sel.handleSceneUpdate(next);
      routeImmerPatches(patches, sel);

      expect(sel.getAllNodes()).toHaveLength(before - 1);
    });
  });
});
