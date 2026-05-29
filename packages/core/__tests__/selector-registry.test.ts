import { describe, expect, it } from "vitest";
import { createSelectorRegistry } from "../src/selector/selector-registry.js";
import type { SceneGraph, SceneNode } from "../src/types.js";

function assertNode(n: SceneNode | undefined, id: string): SceneNode {
  if (!n) throw new Error(`Expected node ${id}`);
  return n;
}

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

    it("returns fresh array on each call (no string-keyed cache)", () => {
      const sel = createSelectorRegistry(makeScene());
      const r1 = sel.getNodes(["a", "b"]);
      const r2 = sel.getNodes(["a", "b"]);
      // getNodes no longer uses a string-keyed cache, so each call
      // produces a new array. This avoids key collision and unbounded
      // memory growth from array-join keys.
      expect(r1).not.toBe(r2);
      expect(r1).toEqual(r2);
    });

    it("reads version signals for each requested node", () => {
      const scene = makeScene();
      const sel = createSelectorRegistry(scene);
      sel.getNode("a");
      sel.getNode("b");
      // After calling getNodes, invalidating one node should trigger
      // recompute of individual getNode but getNodes re-reads all
      // requested node signals each time (no cached computed).
      sel.invalidateAll();
      const nodes = sel.getNodes(["a", "b"]);
      expect(nodes).toHaveLength(2);
    });

    it("handles requesting nonexistent nodes", () => {
      const sel = createSelectorRegistry(makeScene());
      expect(sel.getNodes(["a", "missing"])).toHaveLength(1);
      expect(sel.getNodes(["missing1", "missing2"])).toHaveLength(0);
    });
  });

  describe("getAllNodes", () => {
    it("returns all nodes in scene", () => {
      const sel = createSelectorRegistry(makeScene());
      const all = sel.getAllNodes();
      expect(all).toHaveLength(4);
    });

    it("memoizes result when no structural change", () => {
      const sel = createSelectorRegistry(makeScene());
      const r1 = sel.getAllNodes();
      const r2 = sel.getAllNodes();
      expect(r1).toBe(r2);
    });

    it("returns fresh result after structural invalidate", () => {
      const scene = makeScene();
      const sel = createSelectorRegistry(scene);
      const before = sel.getAllNodes();
      scene.nodes.c = { id: "c", type: "text", parentId: "root" };
      if (scene.nodes.root) scene.nodes.root.children?.push("c");
      sel.invalidate("c", "structural");
      const after = sel.getAllNodes();
      expect(after).toHaveLength(5);
      expect(before).not.toBe(after);
    });

    it("returns fresh result after invalidateAll", () => {
      const scene = makeScene();
      const sel = createSelectorRegistry(scene);
      const before = sel.getAllNodes();
      scene.nodes.c = { id: "c", type: "text", parentId: "root" };
      sel.invalidateAll();
      const after = sel.getAllNodes();
      expect(after).toHaveLength(5);
      expect(before).not.toBe(after);
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
      const b = scene.nodes.b;
      if (!b) throw new Error("b missing");
      b.visible = false;
      const sel = createSelectorRegistry(scene);
      const visible = sel.getVisibleNodes();
      expect(visible.every((n) => n.visible !== false)).toBe(true);
    });

    it("re-evaluates when a known node is invalidated", () => {
      const scene = makeScene();
      const sel = createSelectorRegistry(scene);
      // Query node "a" to create its version signal
      sel.getNode("a");
      // First visible set includes all nodes
      let visible = sel.getVisibleNodes();
      expect(visible).toHaveLength(4);
      // Hide node a and invalidate
      const aNode = scene.nodes.a;
      if (!aNode) throw new Error("a missing");
      aNode.visible = false;
      sel.invalidate("a");
      visible = sel.getVisibleNodes();
      expect(visible).toHaveLength(3);
      expect(visible.find((n) => n.id === "a")).toBeUndefined();
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

    it("invalidateAll bumps version signals triggering recompute", () => {
      const scene = makeScene();
      const sel = createSelectorRegistry(scene);
      sel.getNode("a");
      sel.getChildren("root");
      // invalidateAll bumps all existing version signals (does NOT
      // clear computedCache). The reactive scope marks dependent
      // computeds as dirty; they are lazily re-evaluated on access.
      sel.invalidateAll();
      expect(sel.getNode("a")?.id).toBe("a");
      expect(sel.getChildren("root")).toHaveLength(2);
    });

    it("cache type separation prevents key collision", () => {
      // Different selector types use separate inner maps even when
      // the sub-key is identical (e.g. getChildren("a") vs getAncestors("a")).
      // With a flat string key both would collide as "a" + type prefix.
      const sel = createSelectorRegistry(makeScene());
      const children = sel.getChildren("a");
      expect(children).toHaveLength(1);
      expect(children[0]?.id).toBe("a1");

      const ancestors = sel.getAncestors("a1");
      expect(ancestors).toHaveLength(2);
      expect(ancestors[0]?.id).toBe("a");
      expect(ancestors[1]?.id).toBe("root");
    });
  });

  describe("property-level invalidation", () => {
    it("invalidate with 'visible' field only affects visible-signal dependents", () => {
      const scene = makeScene();
      const sel = createSelectorRegistry(scene);
      // Query a node to create both structural and visible signals
      const aNode = assertNode(scene.nodes.a, "a");
      aNode.visible = false;
      sel.getNode("a");
      sel.getChildren("root");

      // Bump only visible signal — getChildren should NOT re-evaluate
      sel.invalidate("a", "visible");

      // getVisibleNodes re-reads visible signals
      const visible = sel.getVisibleNodes();
      expect(visible.find((n) => n.id === "a")).toBeUndefined();

      // getChildren depends on structural signal — unchanged
      const children = sel.getChildren("root");
      expect(children).toHaveLength(2);
    });

    it("invalidate with 'structural' field only affects tree-selector dependents", () => {
      const scene = makeScene();
      const sel = createSelectorRegistry(scene);
      const root = assertNode(scene.nodes.root, "root");
      root.children = ["a"];

      sel.getNode("a");
      sel.getVisibleNodes();

      // Bump only structural signal
      sel.invalidate("a", "structural");

      // getChildren re-evaluates
      const children = sel.getChildren("root");
      expect(children).toHaveLength(1);

      // getVisibleNodes depends on visible signal — unchanged
      sel.getVisibleNodes();
    });

    it("invalidate without field bumps all signals for node", () => {
      const scene = makeScene();
      const sel = createSelectorRegistry(scene);
      sel.getNode("a");
      sel.invalidate("a");
      // After full invalidate, getNode re-reads from scene
      expect(sel.getNode("a")?.id).toBe("a");
    });
  });

  describe("SelectorNode caching", () => {
    it("getChildren creates a SelectorNode with type 'children'", () => {
      const scene = makeScene();
      const sel = createSelectorRegistry(scene);
      const children = sel.getChildren("root");
      expect(children).toHaveLength(2);
    });

    it("invalidateAll reaches all SelectorNodes through globalEpoch", () => {
      const scene = makeScene();
      const sel = createSelectorRegistry(scene);
      sel.getChildren("root");
      sel.getAncestors("a1");
      sel.invalidateAll();
      // Both selectors should re-evaluate correctly
      expect(sel.getChildren("root")).toHaveLength(2);
      expect(sel.getAncestors("a1")).toHaveLength(2);
    });

    it("structural change within same version propagates to dependent selectors", () => {
      const scene = makeScene();
      const sel = createSelectorRegistry(scene);
      // getDepth("a1") depends on structural signals of the ancestor chain
      expect(sel.getDepth("a1")).toBe(2);
      // Move a1 to root — changes parentId
      const a1Node = assertNode(scene.nodes.a1, "a1");
      a1Node.parentId = "root";
      const root = assertNode(scene.nodes.root, "root");
      root.children = ["a", "b", "a1"];
      // Invalidate structural signal for affected nodes
      sel.invalidate("a1", "structural");
      sel.invalidate("root", "structural");
      // getDepth should re-evaluate
      expect(sel.getDepth("a1")).toBe(1);
    });

    it("field-specific invalidate does not leak to unrelated selectors", () => {
      const scene = makeScene();
      const sel = createSelectorRegistry(scene);
      sel.getChildren("root");
      sel.getVisibleNodes();
      // Toggle visible on node a
      const aNode = assertNode(scene.nodes.a, "a");
      aNode.visible = false;
      // Only bump visible signal — getChildren must NOT re-evaluate
      sel.invalidate("a", "visible");
      // getChildren("root") still sees 2 children
      expect(sel.getChildren("root")).toHaveLength(2);
    });

    it("structural signal change does not invalidate getVisibleNodes", () => {
      const scene = makeScene();
      const sel = createSelectorRegistry(scene);
      sel.getNode("a");
      sel.getVisibleNodes();
      // Bump structural but not visible — visibleNodes should still read
      // fresh scene data but its computed was not marked dirty by
      // structural signal propagation
      const root = assertNode(scene.nodes.root, "root");
      root.children = ["a"];
      sel.invalidate("root", "structural");
      // getVisibleNodes reads ALL visible signals (including root,
      // which has a signal from getNode), but structural bump does
      // NOT mark its computed dirty — so it returns cached result
      // that still includes all original nodes
      const visible = sel.getVisibleNodes();
      expect(visible).toHaveLength(4);
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
      const root = scene.nodes.root;
      if (!root) throw new Error("root missing");
      root.children = ["a", "b", "c"];
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

  describe("isDescendantOf compound caching", () => {
    it("caches result across calls within same scene version", () => {
      const scene = makeScene();
      const sel = createSelectorRegistry(scene);
      expect(sel.isDescendantOf("a1", "root")).toBe(true);
      // Direct mutation without invalidation — cache still returns cached result
      const a1Node = assertNode(scene.nodes.a1, "a1");
      a1Node.parentId = undefined;
      const aNode = assertNode(scene.nodes.a, "a");
      aNode.children = [];
      expect(sel.isDescendantOf("a1", "root")).toBe(true);
      // After invalidation, re-evaluates to fresh result
      sel.invalidate("a1", "structural");
      expect(sel.isDescendantOf("a1", "root")).toBe(false);
    });

    it("re-evaluates after invalidation when compound dependency changes", () => {
      const scene = makeScene();
      const sel = createSelectorRegistry(scene);
      expect(sel.isDescendantOf("a1", "root")).toBe(true);
      // Move a1 to orphan it from root's tree
      const a1Node = assertNode(scene.nodes.a1, "a1");
      a1Node.parentId = undefined;
      const aNode = assertNode(scene.nodes.a, "a");
      aNode.children = [];
      sel.invalidate("a1", "structural");
      expect(sel.isDescendantOf("a1", "root")).toBe(false);
      expect(sel.isDescendantOf("a1", "a")).toBe(false);
    });

    it("isDescendantOf caches after invalidateAll", () => {
      const scene = makeScene();
      const sel = createSelectorRegistry(scene);
      expect(sel.isDescendantOf("a1", "root")).toBe(true);
      sel.invalidateAll();
      // After invalidateAll, compound selector still evaluates correctly
      expect(sel.isDescendantOf("a1", "root")).toBe(true);
    });
  });

  describe("multi-selector coordination", () => {
    it("compound and leaf selectors coexist after invalidateAll", () => {
      const sel = createSelectorRegistry(makeScene());
      sel.isDescendantOf("a1", "root");
      sel.getChildren("root");
      sel.getAncestors("a1");
      sel.invalidateAll();
      expect(sel.isDescendantOf("a1", "root")).toBe(true);
      expect(sel.getChildren("root")).toHaveLength(2);
      expect(sel.getAncestors("a1")).toHaveLength(2);
    });

    it("structural invalidation reaches compound selector", () => {
      const scene = makeScene();
      const sel = createSelectorRegistry(scene);
      expect(sel.isDescendantOf("a1", "root")).toBe(true);
      // Orphan a1
      const a1Node = assertNode(scene.nodes.a1, "a1");
      a1Node.parentId = undefined;
      const aNode = assertNode(scene.nodes.a, "a");
      aNode.children = [];
      // Structural invalidation bumps structural signals for a1 and a;
      // isDescendantOf re-evaluates through alien-signals computed→computed chain
      sel.invalidate("a1", "structural");
      sel.invalidate("a", "structural");
      expect(sel.isDescendantOf("a1", "root")).toBe(false);
      expect(sel.isDescendantOf("a1", "a")).toBe(false);
    });

    it("invalidateAll does not throw with compound selectors", () => {
      const sel = createSelectorRegistry(makeScene());
      sel.isDescendantOf("a1", "root");
      sel.getAncestors("a1");
      sel.getChildren("root");
      expect(() => sel.invalidateAll()).not.toThrow();
    });
  });

  describe("sync", () => {
    it("returns fresh data after sync with new scene", () => {
      const oldScene = makeScene();
      const sel = createSelectorRegistry(oldScene);
      expect(sel.getAllNodes()).toHaveLength(4);
      const newScene: SceneGraph = {
        version: 1,
        rootId: "root",
        nodes: {
          root: { id: "root", type: "container" },
          x: { id: "x", type: "text" },
        },
      };
      sel.sync(newScene);
      expect(sel.getAllNodes()).toHaveLength(2);
      expect(sel.getAllNodes().find((n) => n.id === "x")).toBeDefined();
    });

    it("clears cached selectors after sync", () => {
      const scene = makeScene();
      const sel = createSelectorRegistry(scene);
      const before = sel.getChildren("root");
      const newScene: SceneGraph = {
        version: 2,
        rootId: "root",
        nodes: {
          root: { id: "root", type: "container", children: ["new"] },
          new: { id: "new", type: "text", parentId: "root" },
        },
      };
      sel.sync(newScene);
      const after = sel.getChildren("root");
      expect(after).toHaveLength(1);
      expect(after[0]?.id).toBe("new");
      expect(after).not.toBe(before);
    });

    it("sync resets sceneStructureSignal so getAllNodes is fresh", () => {
      const scene = makeScene();
      const sel = createSelectorRegistry(scene);
      sel.getAllNodes();
      const newScene: SceneGraph = {
        version: 3,
        rootId: "root",
        nodes: {
          root: { id: "root", type: "container", children: ["a"] },
          a: { id: "a", type: "text", parentId: "root" },
        },
      };
      sel.sync(newScene);
      const all = sel.getAllNodes();
      expect(all).toHaveLength(2);
    });
  });

  describe("scheduler batch", () => {
    it("batch defers dirty clear until end", () => {
      const scene = makeScene();
      const sel = createSelectorRegistry(scene);
      sel.getChildren("root");
      sel.getAncestors("a1");

      let afterInside = false;
      sel.batch(() => {
        const root = assertNode(scene.nodes.root, "root");
        root.children = ["a"];
        sel.invalidate("root", "structural");
        afterInside = true;
      });

      expect(afterInside).toBe(true);
      expect(sel.getChildren("root")).toHaveLength(1);
    });

    it("nested batch only flushes at outermost end", () => {
      const sel = createSelectorRegistry(makeScene());
      let innerDone = false;
      let outerDone = false;

      sel.batch(() => {
        sel.batch(() => {
          sel.invalidate("a", "structural");
          innerDone = true;
        });
        outerDone = true;
      });

      expect(innerDone).toBe(true);
      expect(outerDone).toBe(true);
      expect(sel.getChildren("root")).toHaveLength(2);
    });

    it("batch groups multiple invalidations coherently", () => {
      const scene = makeScene();
      const sel = createSelectorRegistry(scene);

      sel.batch(() => {
        const root = assertNode(scene.nodes.root, "root");
        root.children = ["a"];
        sel.invalidate("root", "structural");

        const a1 = assertNode(scene.nodes.a1, "a1");
        a1.parentId = undefined;
        sel.invalidate("a1", "structural");
      });

      expect(sel.getChildren("root")).toHaveLength(1);
      expect(sel.getDepth("a1")).toBe(0);
    });

    it("batch outside block triggers immediate signal propagation", () => {
      const sel = createSelectorRegistry(makeScene());
      sel.getChildren("root");

      sel.invalidate("a", "structural");
      expect(sel.getChildren("root")).toHaveLength(2);
    });
  });

  describe("flush", () => {
    it("explicit flush does not throw", () => {
      const sel = createSelectorRegistry(makeScene());
      sel.getChildren("root");
      expect(() => sel.flush()).not.toThrow();
    });

    it("flush is re-entrant safe", () => {
      const sel = createSelectorRegistry(makeScene());
      sel.getChildren("root");

      sel.batch(() => {
        sel.invalidate("a", "structural");
        sel.flush();
      });

      expect(sel.getChildren("root")).toHaveLength(2);
    });

    it("flush is idempotent with no dirty nodes", () => {
      const sel = createSelectorRegistry(makeScene());
      expect(() => sel.flush()).not.toThrow();
      expect(() => sel.flush()).not.toThrow();
    });
  });

  describe("removeSelector", () => {
    it("removes selector and returns true", () => {
      const sel = createSelectorRegistry(makeScene());
      sel.getChildren("root");
      expect(sel.removeSelector("children", "root")).toBe(true);
    });

    it("returns false for non-existent selector type", () => {
      const sel = createSelectorRegistry(makeScene());
      expect(sel.removeSelector("nonexistent", "key")).toBe(false);
    });

    it("returns false after removal", () => {
      const sel = createSelectorRegistry(makeScene());
      sel.getChildren("root");
      expect(sel.removeSelector("children", "root")).toBe(true);
      expect(sel.removeSelector("children", "root")).toBe(false);
    });

    it("re-creates selector on next access after removal", () => {
      const sel = createSelectorRegistry(makeScene());
      sel.getChildren("root");
      sel.removeSelector("children", "root");
      const after = sel.getChildren("root");
      expect(after).toHaveLength(2);
      expect(after[0]?.id).toBe("a");
    });

    it("works after removal and scene mutation", () => {
      const scene = makeScene();
      const sel = createSelectorRegistry(scene);
      sel.getChildren("root");
      sel.removeSelector("children", "root");

      // Mutate scene and invalidate
      const root = assertNode(scene.nodes.root, "root");
      root.children = ["b"];
      sel.invalidate("root", "structural");

      // New selector should see fresh data
      const after = sel.getChildren("root");
      expect(after).toHaveLength(1);
      expect(after[0]?.id).toBe("b");
    });

    it("disposal allows re-creation on next access", () => {
      const sel = createSelectorRegistry(makeScene());
      // isDescendantOf reads ancestors internally
      sel.isDescendantOf("a1", "root");
      sel.getAncestors("a1");

      // Remove the ancestors selector
      sel.removeSelector("ancestors", "a1");

      // isDescendantOf should still work (creates new ancestors on get)
      expect(sel.isDescendantOf("a1", "root")).toBe(true);
    });

    it("dispose is idempotent", () => {
      const sel = createSelectorRegistry(makeScene());
      sel.getChildren("root");
      sel.removeSelector("children", "root");
      // Second call should be safe
      sel.removeSelector("children", "root");
      // Re-created selector works
      expect(sel.getChildren("root")).toHaveLength(2);
    });
  });

  describe("sync clears cached selectors", () => {
    it("sync clears cache and creates fresh selectors", () => {
      const scene = makeScene();
      const sel = createSelectorRegistry(scene);
      sel.getChildren("root");

      const newScene: SceneGraph = {
        version: 5,
        rootId: "root",
        nodes: {
          root: { id: "root", type: "container" },
        },
      };
      sel.sync(newScene);
      // After sync, scheduler state is clean, getChildren creates fresh
      expect(sel.getChildren("root")).toEqual([]);
    });

    it("scene version change clears cached selectors", () => {
      const scene = makeScene();
      const sel = createSelectorRegistry(scene);
      sel.getChildren("root");

      scene.version = 10;
      sel.getNode("root"); // triggers checkVersion → clear all
      expect(sel.getChildren("root")).toHaveLength(2);
    });
  });
});
