import { describe, it, expect } from "vitest";
import { updateLayoutHandler, updateLayoutInverse } from "../src/runtime/handlers/update-layout.js";
import { RuntimeHandlerError } from "../src/runtime/error.js";
import type { SceneGraph } from "../src/types.js";
import { makeScene, baseNode } from "./helpers.js";

const sceneWithNode: SceneGraph = makeScene({
  root: { id: "root", type: "container", children: ["a"] },
  a: { id: "a", type: "container", parentId: "root", layout: { x: 0, y: 0, width: 100, height: 100 } },
});

describe("updateLayoutHandler", () => {
  it("merges layout fields onto existing layout", () => {
    const action = {
      type: "update-layout" as const,
      nodeId: "a",
      layout: { x: 50, y: 50 },
    };
    const result = updateLayoutHandler(sceneWithNode, action, { now: Date.now });
    expect(result.nodes["a"]?.layout).toEqual({ x: 50, y: 50, width: 100, height: 100 });
    expect(result.version).toBe(1);
  });

  it("creates layout on node that has no layout", () => {
    const scene: SceneGraph = makeScene({
      root: { id: "root", type: "container", children: ["a"] },
      a: { id: "a", type: "container", parentId: "root" },
    });
    const action = {
      type: "update-layout" as const,
      nodeId: "a",
      layout: { x: 10, y: 20 },
    };
    const result = updateLayoutHandler(scene, action, { now: Date.now });
    expect(result.nodes["a"]?.layout).toEqual({ x: 10, y: 20 });
  });

  it("rejects update-layout when node does not exist", () => {
    const action = {
      type: "update-layout" as const,
      nodeId: "missing",
      layout: { x: 0 },
    };
    expect(() => updateLayoutHandler(sceneWithNode, action, { now: Date.now })).toThrow(
      RuntimeHandlerError,
    );
    try {
      updateLayoutHandler(sceneWithNode, action, { now: Date.now });
    } catch (e) {
      expect((e as RuntimeHandlerError).code).toBe("scene.node-not-found");
      expect((e as RuntimeHandlerError).nodeId).toBe("missing");
    }
  });
});

describe("updateLayoutInverse", () => {
  it("produces an update-layout inverse with the original layout", () => {
    const action = {
      type: "update-layout" as const,
      nodeId: "a",
      layout: { x: 50 },
    };
    const inverse = updateLayoutInverse(sceneWithNode, action, { now: Date.now });
    expect(inverse).toEqual({
      type: "update-layout",
      nodeId: "a",
      layout: { x: 0, y: 0, width: 100, height: 100 },
    });
  });

  it("returns undefined when node does not exist in sceneBefore", () => {
    const action = {
      type: "update-layout" as const,
      nodeId: "missing",
      layout: { x: 0 },
    };
    const inverse = updateLayoutInverse(sceneWithNode, action, { now: Date.now });
    expect(inverse).toBeUndefined();
  });
});
