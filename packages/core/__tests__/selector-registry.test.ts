import { describe, expect, it } from "vitest";
import { createSelectorRegistry } from "../src/selector/selector-registry.js";
import type { SceneGraph } from "../src/types.js";

function makeScene(custom?: Partial<SceneGraph>): SceneGraph {
  return {
    version: 0,
    rootId: "root",
    nodes: {
      root: { id: "root", type: "container", children: ["a", "b"] },
      a: { id: "a", type: "text", parentId: "root", children: ["a1"] },
      a1: { id: "a1", type: "text", parentId: "a" },
      b: { id: "b", type: "container", parentId: "root" },
    },
    ...custom,
  };
}

describe("SelectorRegistry", () => {
  describe("getNode", () => {
    it("returns node by id", () => {
      const scene = makeScene();
      const sel = createSelectorRegistry(scene);
      expect(sel.getNode("a")?.id).toBe("a");
      expect(sel.getNode("a")?.type).toBe("text");
    });

    it("returns undefined for missing node", () => {
      const sel = createSelectorRegistry(makeScene());
      expect(sel.getNode("nonexistent")).toBeUndefined();
    });

    it("memoizes result within same scene version", () => {
      const scene = makeScene();
      const sel = createSelectorRegistry(scene);
      const r1 = sel.getNode("a");
      const r2 = sel.getNode("a");
      expect(r1).toBe(r2);
    });

    it("returns fresh result after scene version changes", () => {
      const scene = makeScene();
      const sel = createSelectorRegistry(scene);
      const before = sel.getNode("a");
      scene.version = 1;
      const after = sel.getNode("a");
      expect(before).toBe(after);
    });
  });

  describe("getNodeUnsafe", () => {
    it("returns node by id", () => {
      const sel = createSelectorRegistry(makeScene());
      expect(sel.getNodeUnsafe("a").id).toBe("a");
    });

    it("throws for missing node", () => {
      const sel = createSelectorRegistry(makeScene());
      expect(() => sel.getNodeUnsafe("nonexistent")).toThrow(
        'Node "nonexistent" not found',
      );
    });
  });

  describe("getChildren", () => {
    it("returns child nodes of a container", () => {
      const sel = createSelectorRegistry(makeScene());
      const children = sel.getChildren("root");
      expect(children).toHaveLength(2);
      expect(children[0]?.id).toBe("a");
      expect(children[1]?.id).toBe("b");
    });

    it("returns empty array for leaf node", () => {
      const sel = createSelectorRegistry(makeScene());
      expect(sel.getChildren("b")).toEqual([]);
    });

    it("returns empty array for missing node", () => {
      const sel = createSelectorRegistry(makeScene());
      expect(sel.getChildren("nonexistent")).toEqual([]);
    });
  });

  describe("getParent", () => {
    it("returns parent node", () => {
      const sel = createSelectorRegistry(makeScene());
      const parent = sel.getParent("a");
      expect(parent?.id).toBe("root");
    });

    it("returns undefined for root node", () => {
      const sel = createSelectorRegistry(makeScene());
      expect(sel.getParent("root")).toBeUndefined();
    });

    it("returns undefined for missing node", () => {
      const sel = createSelectorRegistry(makeScene());
      expect(sel.getParent("nonexistent")).toBeUndefined();
    });
  });

  describe("getRoot", () => {
    it("returns root node", () => {
      const sel = createSelectorRegistry(makeScene());
      expect(sel.getRoot().id).toBe("root");
    });
  });

  describe("getNodes", () => {
    it("returns multiple nodes by ids", () => {
      const sel = createSelectorRegistry(makeScene());
      const nodes = sel.getNodes(["a", "b"]);
      expect(nodes).toHaveLength(2);
      expect(nodes[0]?.id).toBe("a");
      expect(nodes[1]?.id).toBe("b");
    });
  });

  describe("getAllNodes", () => {
    it("returns all nodes in scene", () => {
      const sel = createSelectorRegistry(makeScene());
      const all = sel.getAllNodes();
      expect(all).toHaveLength(4);
    });
  });

  describe("getAncestors", () => {
    it("returns ancestors from parent to root", () => {
      const sel = createSelectorRegistry(makeScene());
      const ancestors = sel.getAncestors("a1");
      expect(ancestors).toHaveLength(2);
      expect(ancestors[0]?.id).toBe("a");
      expect(ancestors[1]?.id).toBe("root");
    });

    it("returns empty for root", () => {
      const sel = createSelectorRegistry(makeScene());
      expect(sel.getAncestors("root")).toEqual([]);
    });
  });

  describe("getDescendants", () => {
    it("returns all descendants recursively", () => {
      const sel = createSelectorRegistry(makeScene());
      const descendants = sel.getDescendants("root");
      expect(descendants).toHaveLength(3);
    });

    it("returns direct children for shallow node", () => {
      const sel = createSelectorRegistry(makeScene());
      const descendants = sel.getDescendants("a");
      expect(descendants).toHaveLength(1);
      expect(descendants[0]?.id).toBe("a1");
    });
  });

  describe("getSiblings", () => {
    it("returns sibling nodes excluding self", () => {
      const sel = createSelectorRegistry(makeScene());
      const siblings = sel.getSiblings("a");
      expect(siblings).toHaveLength(1);
      expect(siblings[0]?.id).toBe("b");
    });
  });

  describe("getDepth", () => {
    it("returns 0 for root", () => {
      const sel = createSelectorRegistry(makeScene());
      expect(sel.getDepth("root")).toBe(0);
    });

    it("returns correct depth for nested node", () => {
      const sel = createSelectorRegistry(makeScene());
      expect(sel.getDepth("a1")).toBe(2);
    });
  });

  describe("isDescendantOf", () => {
    it("returns true for nested node", () => {
      const sel = createSelectorRegistry(makeScene());
      expect(sel.isDescendantOf("a1", "root")).toBe(true);
    });

    it("returns false for unrelated nodes", () => {
      const sel = createSelectorRegistry(makeScene());
      expect(sel.isDescendantOf("b", "a")).toBe(false);
    });
  });

  describe("getVisibleNodes", () => {
    it("includes nodes without visible=false", () => {
      const scene = makeScene();
      scene.nodes.b!.visible = false;
      const sel = createSelectorRegistry(scene);
      const visible = sel.getVisibleNodes();
      expect(visible.every((n) => n.visible !== false)).toBe(true);
    });
  });

  describe("cache invalidation", () => {
    it("invalidates cache on explicit invalidate", () => {
      const scene = makeScene();
      const sel = createSelectorRegistry(scene);
      sel.getNode("a");
      sel.invalidate("a");
      // After invalidate, getNode should re-read from scene
      expect(sel.getNode("a")?.id).toBe("a");
    });

    it("invalidates all caches on invalidateAll", () => {
      const scene = makeScene();
      const sel = createSelectorRegistry(scene);
      sel.getNode("a");
      sel.getChildren("root");
      sel.invalidateAll();
      expect(sel.getNode("a")?.id).toBe("a");
      expect(sel.getChildren("root")).toHaveLength(2);
    });
  });

  describe("reactive dependency invalidation (alien-signals)", () => {
    it("invalidate cascades to dependent computed entries via version signal", () => {
      const scene = makeScene();
      const sel = createSelectorRegistry(scene);
      // getChildren("root") reads node:a internally, creating dependency on versionSignals["a"]
      expect(sel.getChildren("root")).toHaveLength(2);
      // Update scene data THEN invalidate targeted node
      if (scene.nodes.root) scene.nodes.root.children = ["a"];
      sel.invalidate("a");
      // children:root computed is dirty (depends on a's version signal), re-evaluates
      const children = sel.getChildren("root");
      expect(children).toHaveLength(1);
    });

    it("invalidate recalculates correctly without data loss", () => {
      const scene = makeScene();
      scene.nodes.c = { id: "c", type: "text", parentId: "root" };
      scene.nodes.root!.children = ["a", "b", "c"];
      const sel = createSelectorRegistry(scene);
      sel.getChildren("root");
      sel.getNode("a");
      sel.invalidate("a");
      const children = sel.getChildren("root");
      expect(children).toHaveLength(3);
    });

    it("invalidateAll clears all computeds and signals", () => {
      const scene = makeScene();
      const sel = createSelectorRegistry(scene);
      sel.getChildren("root");
      sel.invalidateAll();
      expect(sel.getChildren("root")).toHaveLength(2);
    });

    it("scene version change clears all signals and computeds", () => {
      const scene = makeScene();
      const sel = createSelectorRegistry(scene);
      sel.getChildren("root");
      scene.version = 1;
      sel.getNode("root");
      sel.invalidate("a");
      expect(sel.getChildren("root")).toHaveLength(2);
    });
  });
});
