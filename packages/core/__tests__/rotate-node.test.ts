import { describe, it, expect } from "vitest";
import { rotateNodeHandler, rotateNodeInverse } from "../src/runtime/handlers/rotate-node.js";
import { RuntimeHandlerError } from "../src/runtime/error.js";
import type { SceneGraph } from "../src/types.js";
import { makeScene, baseNode } from "./helpers.js";

const sceneWithAbsoluteNode: SceneGraph = makeScene({
  root: { id: "root", type: "container", children: ["a"] },
  a: {
    id: "a",
    type: "container",
    parentId: "root",
    layout: { mode: "absolute" as const, x: 0, y: 0, width: 100, height: 100, rotation: 0 },
  },
});

describe("rotateNodeHandler", () => {
  it("sets rotation on a node with absolute layout", () => {
    const action = {
      type: "rotate-node" as const,
      nodeId: "a",
      rotation: 45,
    };
    const result = rotateNodeHandler(sceneWithAbsoluteNode, action, { now: Date.now });
    expect((result.nodes["a"]?.layout as any)?.rotation).toBe(45);
    expect(result.version).toBe(1);
  });

  it("normalizes rotation into [0, 360) range", () => {
    const action = {
      type: "rotate-node" as const,
      nodeId: "a",
      rotation: 400,
    };
    const result = rotateNodeHandler(sceneWithAbsoluteNode, action, { now: Date.now });
    expect((result.nodes["a"]?.layout as any)?.rotation).toBe(40);
  });

  it("normalizes negative rotation into [0, 360) range", () => {
    const action = {
      type: "rotate-node" as const,
      nodeId: "a",
      rotation: -90,
    };
    const result = rotateNodeHandler(sceneWithAbsoluteNode, action, { now: Date.now });
    expect((result.nodes["a"]?.layout as any)?.rotation).toBe(270);
  });

  it("rejects rotate-node when node does not exist", () => {
    const action = {
      type: "rotate-node" as const,
      nodeId: "missing",
      rotation: 45,
    };
    expect(() => rotateNodeHandler(sceneWithAbsoluteNode, action, { now: Date.now })).toThrow(
      RuntimeHandlerError,
    );
    try {
      rotateNodeHandler(sceneWithAbsoluteNode, action, { now: Date.now });
    } catch (e) {
      expect((e as RuntimeHandlerError).code).toBe("scene.node-not-found");
      expect((e as RuntimeHandlerError).context.nodeId).toBe("missing");
    }
  });

  it("rejects rotate-node when node does not use absolute layout", () => {
    const scene: SceneGraph = makeScene({
      root: { id: "root", type: "container", children: ["a"] },
      a: {
        id: "a",
        type: "container",
        parentId: "root",
        layout: { mode: "flex" as const, direction: "row" },
      },
    });
    const action = {
      type: "rotate-node" as const,
      nodeId: "a",
      rotation: 45,
    };
    expect(() => rotateNodeHandler(scene, action, { now: Date.now })).toThrow(
      RuntimeHandlerError,
    );
    try {
      rotateNodeHandler(scene, action, { now: Date.now });
    } catch (e) {
      expect((e as RuntimeHandlerError).code).toBe("scene.invalid-layout-for-rotation");
    }
  });

  it("rejects rotate-node when node has no layout", () => {
    const scene: SceneGraph = makeScene({
      root: { id: "root", type: "container", children: ["a"] },
      a: { id: "a", type: "container", parentId: "root" },
    });
    const action = {
      type: "rotate-node" as const,
      nodeId: "a",
      rotation: 45,
    };
    expect(() => rotateNodeHandler(scene, action, { now: Date.now })).toThrow(
      RuntimeHandlerError,
    );
    try {
      rotateNodeHandler(scene, action, { now: Date.now });
    } catch (e) {
      expect((e as RuntimeHandlerError).code).toBe("scene.invalid-layout-for-rotation");
    }
  });
});

describe("rotateNodeInverse", () => {
  it("produces a rotate-node inverse with the previous rotation", () => {
    const action = {
      type: "rotate-node" as const,
      nodeId: "a",
      rotation: 90,
    };
    const inverse = rotateNodeInverse(sceneWithAbsoluteNode, action, { now: Date.now });
    expect(inverse).toEqual({
      type: "rotate-node",
      nodeId: "a",
      rotation: 0,
    });
  });

  it("returns undefined when node does not exist in sceneBefore", () => {
    const action = {
      type: "rotate-node" as const,
      nodeId: "missing",
      rotation: 45,
    };
    const inverse = rotateNodeInverse(sceneWithAbsoluteNode, action, { now: Date.now });
    expect(inverse).toBeUndefined();
  });
});
