import { describe, expect, it } from "vitest";
import { HandlerError } from "../src/engine/error.js";
import { removeNodeEntry } from "../src/runtime/handlers/remove-node.js";
import type { SceneGraph } from "../src/types.js";
import { makeScene } from "./helpers.js";

const sceneWithTree: SceneGraph = makeScene({
  root: { id: "root", type: "container", children: ["a", "b"] },
  a: { id: "a", type: "container", parentId: "root", children: ["a1"] },
  a1: { id: "a1", type: "text", parentId: "a" },
  b: { id: "b", type: "container", parentId: "root" },
});

describe("removeNodeEntry.handler", () => {
  it("removes a leaf node and removes its id from parent children", () => {
    const action = { type: "remove-node" as const, nodeId: "b" };
    const result = removeNodeEntry.handler(sceneWithTree, action, {
      now: Date.now,
    });
    expect(result.nodes.b).toBeUndefined();
    expect(result.nodes.root?.children).toEqual(["a"]);
    expect(result.version).toBe(1);
  });

  it("removes a node and all its descendants", () => {
    const action = { type: "remove-node" as const, nodeId: "a" };
    const result = removeNodeEntry.handler(sceneWithTree, action, {
      now: Date.now,
    });
    expect(result.nodes.a).toBeUndefined();
    expect(result.nodes.a1).toBeUndefined();
    expect(result.nodes.root?.children).toEqual(["b"]);
  });

  it("rejects remove-node when target node does not exist", () => {
    const action = { type: "remove-node" as const, nodeId: "missing" };
    expect(() =>
      removeNodeEntry.handler(sceneWithTree, action, { now: Date.now }),
    ).toThrow(HandlerError);
    try {
      removeNodeEntry.handler(sceneWithTree, action, { now: Date.now });
    } catch (e) {
      expect((e as HandlerError).code).toBe("scene.node-not-found");
      expect((e as HandlerError).context.nodeId).toBe("missing");
    }
  });

  it("rejects remove-node when target is the root node", () => {
    const action = { type: "remove-node" as const, nodeId: "root" };
    expect(() =>
      removeNodeEntry.handler(sceneWithTree, action, { now: Date.now }),
    ).toThrow(HandlerError);
    try {
      removeNodeEntry.handler(sceneWithTree, action, { now: Date.now });
    } catch (e) {
      expect((e as HandlerError).code).toBe("scene.root-mutation");
      expect((e as HandlerError).context.nodeId).toBe("root");
    }
  });
});

describe("removeNodeEntry.inverse", () => {
  it("produces a create-node inverse with the original node and parent info", () => {
    const action = { type: "remove-node" as const, nodeId: "b" };
    const inverse = removeNodeEntry.inverse(sceneWithTree, action, {
      now: Date.now,
    });
    expect(inverse).toEqual({
      type: "create-node",
      node: sceneWithTree.nodes.b,
      parentId: "root",
      index: 1,
    });
  });

  it("produces a batch-actions inverse that restores all descendants for subtree removal", () => {
    const action = { type: "remove-node" as const, nodeId: "a" };
    const inverse = removeNodeEntry.inverse(sceneWithTree, action, {
      now: Date.now,
    });
    expect(inverse).toBeDefined();
    if (inverse?.type === "batch-actions") {
      expect(inverse.actions).toHaveLength(2);
      const action0 = inverse.actions[0];
      const action1 = inverse.actions[1];
      if (action0?.type === "create-node") expect(action0.node.id).toBe("a");
      if (action1?.type === "create-node") expect(action1.node.id).toBe("a1");
    } else {
      // Single-node removal still returns a single create-node
      expect(inverse?.type).toBe("create-node");
    }
  });

  it("returns undefined when node does not exist in sceneBefore", () => {
    const action = { type: "remove-node" as const, nodeId: "missing" };
    const inverse = removeNodeEntry.inverse(sceneWithTree, action, {
      now: Date.now,
    });
    expect(inverse).toBeUndefined();
  });
});
