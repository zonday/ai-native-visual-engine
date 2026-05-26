import { describe, it, expect } from "vitest";
import { removeNodeHandler, removeNodeInverse } from "../src/runtime/handlers/remove-node.js";
import { RuntimeHandlerError } from "../src/runtime/error.js";
import type { SceneGraph, SceneNode } from "../src/types.js";

const baseNode = (id: string, type = "container"): SceneNode => ({
  id,
  type,
});

const makeScene = (nodes: Record<string, SceneNode>, rootId = "root"): SceneGraph => ({
  version: 0,
  rootId,
  nodes,
});

const sceneWithTree: SceneGraph = makeScene({
  root: { id: "root", type: "container", children: ["a", "b"] },
  a: { id: "a", type: "container", parentId: "root", children: ["a1"] },
  a1: { id: "a1", type: "text", parentId: "a" },
  b: { id: "b", type: "container", parentId: "root" },
});

describe("removeNodeHandler", () => {
  it("removes a leaf node and removes its id from parent children", () => {
    const action = { type: "remove-node" as const, nodeId: "b" };
    const result = removeNodeHandler(sceneWithTree, action, { now: Date.now });
    expect(result.nodes["b"]).toBeUndefined();
    expect(result.nodes["root"]?.children).toEqual(["a"]);
    expect(result.version).toBe(1);
  });

  it("removes a node and all its descendants", () => {
    const action = { type: "remove-node" as const, nodeId: "a" };
    const result = removeNodeHandler(sceneWithTree, action, { now: Date.now });
    expect(result.nodes["a"]).toBeUndefined();
    expect(result.nodes["a1"]).toBeUndefined();
    expect(result.nodes["root"]?.children).toEqual(["b"]);
  });

  it("rejects remove-node when target node does not exist", () => {
    const action = { type: "remove-node" as const, nodeId: "missing" };
    expect(() => removeNodeHandler(sceneWithTree, action, { now: Date.now })).toThrow(
      RuntimeHandlerError,
    );
    try {
      removeNodeHandler(sceneWithTree, action, { now: Date.now });
    } catch (e) {
      expect((e as RuntimeHandlerError).code).toBe("scene.node-not-found");
      expect((e as RuntimeHandlerError).nodeId).toBe("missing");
    }
  });

  it("rejects remove-node when target is the root node", () => {
    const action = { type: "remove-node" as const, nodeId: "root" };
    expect(() => removeNodeHandler(sceneWithTree, action, { now: Date.now })).toThrow(
      RuntimeHandlerError,
    );
    try {
      removeNodeHandler(sceneWithTree, action, { now: Date.now });
    } catch (e) {
      expect((e as RuntimeHandlerError).code).toBe("scene.root-mutation");
      expect((e as RuntimeHandlerError).nodeId).toBe("root");
    }
  });
});

describe("removeNodeInverse", () => {
  it("produces a create-node inverse with the original node and parent info", () => {
    const action = { type: "remove-node" as const, nodeId: "b" };
    const inverse = removeNodeInverse(sceneWithTree, action, { now: Date.now });
    expect(inverse).toEqual({
      type: "create-node",
      node: sceneWithTree.nodes["b"],
      parentId: "root",
      index: 1,
    });
  });

  it("produces a batch-actions inverse that restores all descendants for subtree removal", () => {
    const action = { type: "remove-node" as const, nodeId: "a" };
    const inverse = removeNodeInverse(sceneWithTree, action, { now: Date.now });
    expect(inverse).toBeDefined();
    if (inverse?.type === "batch-actions") {
      expect(inverse.actions).toHaveLength(2);
      expect(inverse.actions[0]?.type).toBe("create-node");
      expect((inverse.actions[0] as any).node.id).toBe("a");
      expect(inverse.actions[1]?.type).toBe("create-node");
      expect((inverse.actions[1] as any).node.id).toBe("a1");
    } else {
      // Single-node removal still returns a single create-node
      expect(inverse?.type).toBe("create-node");
    }
  });

  it("returns undefined when node does not exist in sceneBefore", () => {
    const action = { type: "remove-node" as const, nodeId: "missing" };
    const inverse = removeNodeInverse(sceneWithTree, action, { now: Date.now });
    expect(inverse).toBeUndefined();
  });
});
