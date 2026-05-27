import { describe, expect, it } from "vitest";
import { createComputedStateEngine } from "../src/computed/computed-state-engine.js";
import { createSelectorRegistry } from "../src/selector/selector-registry.js";
import type { SceneGraph } from "../src/types.js";

function makeScene(custom?: Partial<SceneGraph>): SceneGraph {
  return {
    version: 0,
    rootId: "root",
    nodes: {
      root: { id: "root", type: "container", children: ["a"] },
      a: {
        id: "a",
        type: "container",
        parentId: "root",
        children: ["a1"],
        layout: { mode: "absolute" as const, x: 100, y: 50, width: 200, height: 100 },
      },
      a1: {
        id: "a1",
        type: "text",
        parentId: "a",
        layout: { mode: "absolute" as const, x: 10, y: 20, width: 100, height: 30 },
      },
    },
    ...custom,
  };
}

describe("ComputedStateEngine", () => {
  describe("getWorldTransform", () => {
    it("returns identity for root", () => {
      const sel = createSelectorRegistry(makeScene());
      const eng = createComputedStateEngine(sel);
      const tx = eng.getWorldTransform("root");
      expect(tx.x).toBe(0);
      expect(tx.y).toBe(0);
      expect(tx.rotation).toBe(0);
    });

    it("returns local position for direct child of root", () => {
      const sel = createSelectorRegistry(makeScene());
      const eng = createComputedStateEngine(sel);
      const tx = eng.getWorldTransform("a");
      expect(tx.x).toBe(100);
      expect(tx.y).toBe(50);
    });

    it("accumulates parent transform for nested node", () => {
      const sel = createSelectorRegistry(makeScene());
      const eng = createComputedStateEngine(sel);
      const tx = eng.getWorldTransform("a1");
      expect(tx.x).toBe(110);
      expect(tx.y).toBe(70);
    });

    it("memoizes result for same node", () => {
      const sel = createSelectorRegistry(makeScene());
      const eng = createComputedStateEngine(sel);
      const r1 = eng.getWorldTransform("a1");
      const r2 = eng.getWorldTransform("a1");
      expect(r1).toBe(r2);
    });
  });

  describe("getComputedBounds", () => {
    it("returns correct bounds for root child", () => {
      const sel = createSelectorRegistry(makeScene());
      const eng = createComputedStateEngine(sel);
      const bounds = eng.getComputedBounds("a");
      expect(bounds.x).toBe(100);
      expect(bounds.y).toBe(50);
      expect(bounds.width).toBe(200);
      expect(bounds.height).toBe(100);
    });

    it("returns accumulated bounds for nested node", () => {
      const sel = createSelectorRegistry(makeScene());
      const eng = createComputedStateEngine(sel);
      const bounds = eng.getComputedBounds("a1");
      expect(bounds.x).toBe(110);
      expect(bounds.y).toBe(70);
      expect(bounds.width).toBe(100);
      expect(bounds.height).toBe(30);
    });

    it("returns default sizes when layout has no width/height", () => {
      const scene = makeScene();
      scene.nodes.c = { id: "c", type: "text", parentId: "root" };
      scene.nodes.root.children = ["a", "c"];
      const sel = createSelectorRegistry(scene);
      const eng = createComputedStateEngine(sel);
      const bounds = eng.getComputedBounds("c");
      expect(bounds.width).toBeGreaterThan(0);
      expect(bounds.height).toBeGreaterThan(0);
    });
  });

  describe("getVisibleBounds", () => {
    it("returns bounds for visible node", () => {
      const sel = createSelectorRegistry(makeScene());
      const eng = createComputedStateEngine(sel);
      const vb = eng.getVisibleBounds("a");
      expect(vb).not.toBeNull();
      expect(vb!.width).toBe(200);
    });

    it("returns null for invisible node", () => {
      const scene = makeScene();
      scene.nodes.a.visible = false;
      const sel = createSelectorRegistry(scene);
      const eng = createComputedStateEngine(sel);
      expect(eng.getVisibleBounds("a")).toBeNull();
    });
  });

  describe("getCenter", () => {
    it("returns center of node bounds", () => {
      const sel = createSelectorRegistry(makeScene());
      const eng = createComputedStateEngine(sel);
      const center = eng.getCenter("a");
      expect(center.x).toBe(200);
      expect(center.y).toBe(100);
    });
  });

  describe("getEdge", () => {
    it("returns correct edge values", () => {
      const sel = createSelectorRegistry(makeScene());
      const eng = createComputedStateEngine(sel);
      expect(eng.getEdge("a", "left")).toBe(100);
      expect(eng.getEdge("a", "top")).toBe(50);
      expect(eng.getEdge("a", "right")).toBe(300);
      expect(eng.getEdge("a", "bottom")).toBe(150);
    });
  });

  describe("cache invalidation", () => {
    it("recomputes after invalidate", () => {
      const sel = createSelectorRegistry(makeScene());
      const eng = createComputedStateEngine(sel);
      const before = eng.getWorldTransform("a");
      eng.invalidate("a");
      const after = eng.getWorldTransform("a");
      expect(after.x).toBe(before.x);
    });

    it("returns consistent results after mutation", () => {
      const scene = makeScene();
      const sel = createSelectorRegistry(scene);
      const eng = createComputedStateEngine(sel);
      const before = eng.getComputedBounds("a1");
      // Simulate moving node a
      (scene.nodes.a.layout as Record<string, unknown>).x = 200;
      scene.version = 1;
      sel.invalidateAll();
      eng.invalidateAll();
      const after = eng.getComputedBounds("a1");
      expect(after.x).toBe(210);
      expect(after.y).toBe(before.y);
    });
  });
});
