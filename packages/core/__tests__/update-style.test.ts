import { describe, it, expect } from "vitest";
import { updateStyleHandler, updateStyleInverse } from "../src/runtime/handlers/update-style.js";
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

const sceneWithNode: SceneGraph = makeScene({
  root: { id: "root", type: "container", children: ["a"] },
  a: { id: "a", type: "container", parentId: "root", style: { color: "red", fontSize: 14 } },
});

describe("updateStyleHandler", () => {
  it("replaces the entire style object on the target node", () => {
    const action = {
      type: "update-style" as const,
      nodeId: "a",
      style: { color: "blue" },
    };
    const result = updateStyleHandler(sceneWithNode, action, { now: Date.now });
    expect(result.nodes["a"]?.style).toEqual({ color: "blue" });
    expect(result.version).toBe(1);
  });

  it("sets style on node that has no existing style", () => {
    const scene: SceneGraph = makeScene({
      root: { id: "root", type: "container", children: ["a"] },
      a: { id: "a", type: "container", parentId: "root" },
    });
    const action = {
      type: "update-style" as const,
      nodeId: "a",
      style: { color: "green" },
    };
    const result = updateStyleHandler(scene, action, { now: Date.now });
    expect(result.nodes["a"]?.style).toEqual({ color: "green" });
  });

  it("rejects update-style when node does not exist", () => {
    const action = {
      type: "update-style" as const,
      nodeId: "missing",
      style: { color: "blue" },
    };
    expect(() => updateStyleHandler(sceneWithNode, action, { now: Date.now })).toThrow(
      RuntimeHandlerError,
    );
    try {
      updateStyleHandler(sceneWithNode, action, { now: Date.now });
    } catch (e) {
      expect((e as RuntimeHandlerError).code).toBe("scene.node-not-found");
      expect((e as RuntimeHandlerError).nodeId).toBe("missing");
    }
  });
});

describe("updateStyleInverse", () => {
  it("produces an update-style inverse with the original style", () => {
    const action = {
      type: "update-style" as const,
      nodeId: "a",
      style: { color: "blue" },
    };
    const inverse = updateStyleInverse(sceneWithNode, action, { now: Date.now });
    expect(inverse).toEqual({
      type: "update-style",
      nodeId: "a",
      style: { color: "red", fontSize: 14 },
    });
  });

  it("returns undefined when node does not exist in sceneBefore", () => {
    const action = {
      type: "update-style" as const,
      nodeId: "missing",
      style: { color: "blue" },
    };
    const inverse = updateStyleInverse(sceneWithNode, action, { now: Date.now });
    expect(inverse).toBeUndefined();
  });
});
