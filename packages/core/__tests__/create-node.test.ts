import { describe, it, expect } from "vitest";
import { createNodeHandler, createNodeInverse } from "../src/runtime/handlers/create-node.js";
import { RuntimeHandlerError } from "../src/runtime/error.js";
import type { SceneGraph } from "../src/types.js";
import { makeScene, baseNode, emptyScene } from "./helpers.js";

describe("createNodeHandler", () => {
  it("creates a node and appends it to parent children when index is omitted", () => {
    const action = {
      type: "create-node" as const,
      node: baseNode("child-1"),
      parentId: "root",
    };
    const result = createNodeHandler(emptyScene, action, { now: Date.now, actorId: "test" });
    expect(result.nodes["child-1"]).toBeDefined();
    expect(result.nodes["child-1"]?.parentId).toBe("root");
    expect(result.nodes["root"]?.children).toEqual(["child-1"]);
    expect(result.version).toBe(1);
  });

  it("inserts a node at the specified index", () => {
    const scene: SceneGraph = makeScene({
      root: { id: "root", type: "container", children: ["a", "b"] },
      a: baseNode("a"),
      b: baseNode("b"),
    });
    const action = {
      type: "create-node" as const,
      node: baseNode("c"),
      parentId: "root",
      index: 1,
    };
    const result = createNodeHandler(scene, action, { now: Date.now });
    expect(result.nodes["root"]?.children).toEqual(["a", "c", "b"]);
  });

  it("clamps out-of-bounds index to parent children length", () => {
    const scene: SceneGraph = makeScene({
      root: { id: "root", type: "container", children: ["a"] },
      a: baseNode("a"),
    });
    const action = {
      type: "create-node" as const,
      node: baseNode("b"),
      parentId: "root",
      index: 99,
    };
    const result = createNodeHandler(scene, action, { now: Date.now });
    expect(result.nodes["root"]?.children).toEqual(["a", "b"]);
  });

  it("rejects create-node when parent does not exist", () => {
    const action = {
      type: "create-node" as const,
      node: baseNode("orphan"),
      parentId: "missing-parent",
    };
    expect(() => createNodeHandler(emptyScene, action, { now: Date.now })).toThrow(
      RuntimeHandlerError,
    );
    try {
      createNodeHandler(emptyScene, action, { now: Date.now });
    } catch (e) {
      expect((e as RuntimeHandlerError).code).toBe("scene.invalid-parent");
      expect((e as RuntimeHandlerError).nodeId).toBe("missing-parent");
    }
  });

  it("rejects create-node when node id already exists", () => {
    const action = {
      type: "create-node" as const,
      node: baseNode("root"),
      parentId: "root",
    };
    expect(() => createNodeHandler(emptyScene, action, { now: Date.now })).toThrow(
      RuntimeHandlerError,
    );
    try {
      createNodeHandler(emptyScene, action, { now: Date.now });
    } catch (e) {
      expect((e as RuntimeHandlerError).code).toBe("scene.duplicate-node-id");
      expect((e as RuntimeHandlerError).nodeId).toBe("root");
    }
  });
});

describe("createNodeInverse", () => {
  it("produces a remove-node inverse action for the created node", () => {
    const action = {
      type: "create-node" as const,
      node: baseNode("child-1"),
      parentId: "root",
    };
    const inverse = createNodeInverse(emptyScene, action, { now: Date.now });
    expect(inverse).toEqual({
      type: "remove-node",
      nodeId: "child-1",
    });
  });
});
