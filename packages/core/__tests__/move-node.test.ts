import { describe, expect, it } from "vitest";
import { HandlerError } from "../src/engine/error.js";
import {
  moveNodeHandler,
  moveNodeInverse,
} from "../src/runtime/handlers/move-node.js";
import type { SceneGraph } from "../src/types.js";
import { makeScene } from "./helpers.js";

const sceneWithTree: SceneGraph = makeScene({
  root: { id: "root", type: "container", children: ["a", "b"] },
  a: { id: "a", type: "container", parentId: "root", children: ["a1"] },
  a1: { id: "a1", type: "text", parentId: "a" },
  b: { id: "b", type: "container", parentId: "root" },
});

describe("moveNodeHandler", () => {
  it("moves a node from one parent to another and appends when index is omitted", () => {
    const action = {
      type: "move-node" as const,
      nodeId: "a1",
      parentId: "b",
    };
    const result = moveNodeHandler(sceneWithTree, action, { now: Date.now });
    expect(result.nodes.a1?.parentId).toBe("b");
    expect(result.nodes.a?.children).toEqual([]);
    expect(result.nodes.b?.children).toEqual(["a1"]);
    expect(result.version).toBe(1);
  });

  it("moves a node to a specific index within the new parent", () => {
    const scene: SceneGraph = makeScene({
      root: { id: "root", type: "container", children: ["a", "b"] },
      a: {
        id: "a",
        type: "container",
        parentId: "root",
        children: ["a1", "a2"],
      },
      a1: { id: "a1", type: "text", parentId: "a" },
      a2: { id: "a2", type: "text", parentId: "a" },
      b: { id: "b", type: "container", parentId: "root", children: ["b1"] },
      b1: { id: "b1", type: "text", parentId: "b" },
    });
    const action = {
      type: "move-node" as const,
      nodeId: "a1",
      parentId: "b",
      index: 0,
    };
    const result = moveNodeHandler(scene, action, { now: Date.now });
    expect(result.nodes.b?.children).toEqual(["a1", "b1"]);
    expect(result.nodes.a?.children).toEqual(["a2"]);
  });

  it("reorders a node within the same parent", () => {
    const scene: SceneGraph = makeScene({
      root: { id: "root", type: "container", children: ["a", "b", "c"] },
      a: { id: "a", type: "container", parentId: "root" },
      b: { id: "b", type: "container", parentId: "root" },
      c: { id: "c", type: "container", parentId: "root" },
    });
    const action = {
      type: "move-node" as const,
      nodeId: "a",
      parentId: "root",
      index: 2,
    };
    const result = moveNodeHandler(scene, action, { now: Date.now });
    expect(result.nodes.root?.children).toEqual(["b", "c", "a"]);
  });

  it("rejects move-node when target node does not exist", () => {
    const action = {
      type: "move-node" as const,
      nodeId: "missing",
      parentId: "root",
    };
    expect(() =>
      moveNodeHandler(sceneWithTree, action, { now: Date.now }),
    ).toThrow(HandlerError);
    try {
      moveNodeHandler(sceneWithTree, action, { now: Date.now });
    } catch (e) {
      expect((e as HandlerError).code).toBe("scene.node-not-found");
      expect((e as HandlerError).context.nodeId).toBe("missing");
    }
  });

  it("rejects move-node when new parent does not exist", () => {
    const action = {
      type: "move-node" as const,
      nodeId: "a1",
      parentId: "missing-parent",
    };
    expect(() =>
      moveNodeHandler(sceneWithTree, action, { now: Date.now }),
    ).toThrow(HandlerError);
    try {
      moveNodeHandler(sceneWithTree, action, { now: Date.now });
    } catch (e) {
      expect((e as HandlerError).code).toBe("scene.invalid-parent");
      expect((e as HandlerError).context.nodeId).toBe("missing-parent");
    }
  });

  it("rejects move-node when moving a node into itself", () => {
    const action = {
      type: "move-node" as const,
      nodeId: "a",
      parentId: "a",
    };
    expect(() =>
      moveNodeHandler(sceneWithTree, action, { now: Date.now }),
    ).toThrow(HandlerError);
    try {
      moveNodeHandler(sceneWithTree, action, { now: Date.now });
    } catch (e) {
      expect((e as HandlerError).code).toBe("scene.cycle-detected");
    }
  });

  it("rejects move-node when moving a parent into its own descendant", () => {
    const action = {
      type: "move-node" as const,
      nodeId: "a",
      parentId: "a1",
    };
    expect(() =>
      moveNodeHandler(sceneWithTree, action, { now: Date.now }),
    ).toThrow(HandlerError);
    try {
      moveNodeHandler(sceneWithTree, action, { now: Date.now });
    } catch (e) {
      expect((e as HandlerError).code).toBe("scene.cycle-detected");
    }
  });
});

describe("moveNodeInverse", () => {
  it("produces a move-node inverse that restores the original parent and index", () => {
    const action = {
      type: "move-node" as const,
      nodeId: "a1",
      parentId: "b",
    };
    const inverse = moveNodeInverse(sceneWithTree, action, { now: Date.now });
    expect(inverse).toEqual({
      type: "move-node",
      nodeId: "a1",
      parentId: "a",
      index: 0,
    });
  });

  it("returns undefined when node does not exist in sceneBefore", () => {
    const action = {
      type: "move-node" as const,
      nodeId: "missing",
      parentId: "root",
    };
    const inverse = moveNodeInverse(sceneWithTree, action, { now: Date.now });
    expect(inverse).toBeUndefined();
  });
});
