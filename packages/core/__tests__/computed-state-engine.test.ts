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
        layout: {
          mode: "absolute" as const,
          x: 100,
          y: 50,
          width: 200,
          height: 100,
        },
      },
      a1: {
        id: "a1",
        type: "text",
        parentId: "a",
        layout: {
          mode: "absolute" as const,
          x: 10,
          y: 20,
          width: 100,
          height: 30,
        },
      },
    },
    ...custom,
  };
}

describe("ComputedStateEngine", () => {
  describe("getWorldTransform", () => {
    it("composes rotation correctly", () => {
      const scene = makeScene();
      const a = scene.nodes.a;
      if (!a?.layout) throw new Error("a or layout missing");
      // Parent "a" rotated 90°, child "a1" at (10, 20) relative
      a.layout.rotation = 90;
      const sel = createSelectorRegistry(scene);
      const eng = createComputedStateEngine(sel);
      // a1: parent rotates (10, 20) → (-20, 10), then adds parent at (100, 50)
      // Expected: x = 100 + (-20) = 80, y = 50 + 10 = 60
      const tx = eng.getWorldTransform("a1");
      expect(tx.x).toBeCloseTo(80);
      expect(tx.y).toBeCloseTo(60);
      expect(tx.rotation).toBe(90);
    });

    it("propagates scale through hierarchy", () => {
      const scene = makeScene();
      const a = scene.nodes.a;
      if (!a?.layout) throw new Error("a or layout missing");
      (a.layout as Record<string, unknown>).scaleX = 2;
      (a.layout as Record<string, unknown>).scaleY = 3;
      const sel = createSelectorRegistry(scene);
      const eng = createComputedStateEngine(sel);
      const tx = eng.getWorldTransform("a1");
      // "a" scales (10, 20) by (2, 3) → (20, 60), adds parent (100, 50)
      expect(tx.x).toBe(120);
      expect(tx.y).toBe(110);
      expect(tx.scaleX).toBe(2);
      expect(tx.scaleY).toBe(3);
    });

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
      const root = scene.nodes.root;
      if (!root) throw new Error("root missing");
      root.children = ["a", "c"];
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
      expect(vb?.width).toBe(200);
    });

    it("returns null for invisible node", () => {
      const scene = makeScene();
      const a = scene.nodes.a;
      if (!a) throw new Error("a missing");
      a.visible = false;
      const sel = createSelectorRegistry(scene);
      const eng = createComputedStateEngine(sel);
      expect(eng.getVisibleBounds("a")).toBeNull();
    });

    it("clips to viewport when viewport rect is provided", () => {
      const sel = createSelectorRegistry(makeScene());
      const eng = createComputedStateEngine(sel);
      // Node "a" is at (100, 50) with size 200x100
      // Viewport is at (150, 60) with size 100x80
      // Intersection should be (150, 60) with size 100x80 (clipped to viewport)
      const vb = eng.getVisibleBounds("a", {
        x: 150,
        y: 60,
        width: 100,
        height: 80,
      });
      expect(vb).not.toBeNull();
      expect(vb?.x).toBe(150);
      expect(vb?.y).toBe(60);
      expect(vb?.width).toBe(100);
      expect(vb?.height).toBe(80);
    });

    it("returns zero bounds when node is outside viewport", () => {
      const sel = createSelectorRegistry(makeScene());
      const eng = createComputedStateEngine(sel);
      // Node "a" is at (100, 50), viewport is far away
      const vb = eng.getVisibleBounds("a", {
        x: 500,
        y: 500,
        width: 100,
        height: 100,
      });
      expect(vb).not.toBeNull();
      expect(vb?.width).toBe(0);
      expect(vb?.height).toBe(0);
    });
  });

  describe("getLocalTransform", () => {
    it("returns WorldTransform with scale defaults for absolute node", () => {
      const sel = createSelectorRegistry(makeScene());
      const eng = createComputedStateEngine(sel);
      const tx = eng.getLocalTransform("a");
      expect(tx.x).toBe(100);
      expect(tx.y).toBe(50);
      expect(tx.rotation).toBe(0);
      expect(tx.scaleX).toBe(1);
      expect(tx.scaleY).toBe(1);
    });

    it("returns identity for non-absolute node", () => {
      const scene = makeScene();
      if (scene.nodes.a) delete scene.nodes.a.layout;
      const sel = createSelectorRegistry(scene);
      const eng = createComputedStateEngine(sel);
      const tx = eng.getLocalTransform("a");
      expect(tx.x).toBe(0);
      expect(tx.y).toBe(0);
      expect(tx.rotation).toBe(0);
      expect(tx.scaleX).toBe(1);
      expect(tx.scaleY).toBe(1);
    });

    it("reads scale from layout when present", () => {
      const scene = makeScene();
      const a = scene.nodes.a;
      if (!a?.layout) throw new Error("a or layout missing");
      (a.layout as Record<string, unknown>).scaleX = 2;
      (a.layout as Record<string, unknown>).scaleY = 3;
      const sel = createSelectorRegistry(scene);
      const eng = createComputedStateEngine(sel);
      const tx = eng.getLocalTransform("a");
      expect(tx.scaleX).toBe(2);
      expect(tx.scaleY).toBe(3);
    });

    it("returns identity for missing node", () => {
      const sel = createSelectorRegistry(makeScene());
      const eng = createComputedStateEngine(sel);
      const tx = eng.getLocalTransform("nonexistent");
      expect(tx.x).toBe(0);
      expect(tx.y).toBe(0);
      expect(tx.rotation).toBe(0);
      expect(tx.scaleX).toBe(1);
      expect(tx.scaleY).toBe(1);
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
    it("invalidate cascades to descendants", () => {
      const scene = makeScene();
      const sel = createSelectorRegistry(scene);
      const eng = createComputedStateEngine(sel);
      // Warm both caches
      eng.getWorldTransform("a");
      eng.getWorldTransform("a1");
      // Mutate node a's layout
      (scene.nodes.a?.layout as Record<string, unknown>).x = 200;
      // Invalidate "a" — cascades to descendant "a1"
      eng.invalidate("a");
      // "a" recomputes from fresh scene data
      const afterA = eng.getWorldTransform("a");
      expect(afterA.x).toBe(200);
      // "a1" cache was also cleared as descendant — reads world through new parent
      const afterA1 = eng.getWorldTransform("a1");
      expect(afterA1.x).toBe(210);
    });

    it("invalidateAll clears all caches for full recompute", () => {
      const scene = makeScene();
      const sel = createSelectorRegistry(scene);
      const eng = createComputedStateEngine(sel);
      eng.getWorldTransform("a1");
      (scene.nodes.a?.layout as Record<string, unknown>).x = 200;
      // Full invalidation of both layers
      sel.invalidateAll();
      eng.invalidateAll();
      const after = eng.getWorldTransform("a1");
      expect(after.x).toBe(210);
    });

    it("invalidateAll on engine cascades to selector registry and recalculates", () => {
      const scene = makeScene();
      const sel = createSelectorRegistry(scene);
      const eng = createComputedStateEngine(sel);
      eng.getWorldTransform("a1");
      (scene.nodes.a?.layout as Record<string, unknown>).x = 200;
      // Engine's invalidateAll also calls selectors.invalidateAll
      eng.invalidateAll();
      const after = eng.getWorldTransform("a1");
      expect(after.x).toBe(210);
    });

    it("invalidate on missing nodeId does not throw", () => {
      const sel = createSelectorRegistry(makeScene());
      const eng = createComputedStateEngine(sel);
      expect(() => eng.invalidate("nonexistent")).not.toThrow();
      // Existing nodes still work after invalidating a nonexistent one
      eng.getWorldTransform("a");
      expect(() => eng.invalidate("nonexistent")).not.toThrow();
      const tx = eng.getWorldTransform("a");
      expect(tx.x).toBe(100);
    });

    it("onBeforeDispose clears engine caches when selector registry syncs", () => {
      const oldScene = makeScene();
      const sel = createSelectorRegistry(oldScene);
      const eng = createComputedStateEngine(sel);

      // Warm caches with old scene data
      const before = eng.getWorldTransform("a1");
      expect(before.x).toBe(110);

      // Create a new scene with changed layout
      const newScene = makeScene();
      const aLayout = newScene.nodes.a?.layout as Record<string, unknown>;
      aLayout.x = 300;
      newScene.version = 1;

      // Sync triggers onBeforeDispose → clearAll(), then replaces scene
      sel.sync(newScene);

      // After sync, engine reads from new scene — fresh computed refs
      const after = eng.getWorldTransform("a1");
      expect(after.x).toBe(310);
    });
  });
});
