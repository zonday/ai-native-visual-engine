import { describe, it, expect } from "vitest";
import { updateRuntimeHandler, updateRuntimeInverse } from "../src/runtime/handlers/update-runtime.js";
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
  a: { id: "a", type: "container", parentId: "root", runtime: { isLoading: true, count: 5 } },
});

describe("updateRuntimeHandler", () => {
  it("shallow-merges runtime state onto existing runtime", () => {
    const action = {
      type: "update-runtime" as const,
      nodeId: "a",
      runtime: { isLoading: false },
    };
    const result = updateRuntimeHandler(sceneWithNode, action, { now: Date.now });
    expect(result.nodes["a"]?.runtime).toEqual({ isLoading: false, count: 5 });
    expect(result.version).toBe(1);
  });

  it("adds runtime state when node has no existing runtime", () => {
    const scene: SceneGraph = makeScene({
      root: { id: "root", type: "container", children: ["a"] },
      a: { id: "a", type: "container", parentId: "root" },
    });
    const action = {
      type: "update-runtime" as const,
      nodeId: "a",
      runtime: { isLoading: true },
    };
    const result = updateRuntimeHandler(scene, action, { now: Date.now });
    expect(result.nodes["a"]?.runtime).toEqual({ isLoading: true });
  });

  it("rejects update-runtime when node does not exist", () => {
    const action = {
      type: "update-runtime" as const,
      nodeId: "missing",
      runtime: { isLoading: true },
    };
    expect(() => updateRuntimeHandler(sceneWithNode, action, { now: Date.now })).toThrow(
      RuntimeHandlerError,
    );
    try {
      updateRuntimeHandler(sceneWithNode, action, { now: Date.now });
    } catch (e) {
      expect((e as RuntimeHandlerError).code).toBe("scene.node-not-found");
      expect((e as RuntimeHandlerError).nodeId).toBe("missing");
    }
  });
});

describe("updateRuntimeInverse", () => {
  it("produces an update-runtime inverse that deletes the changed keys", () => {
    const action = {
      type: "update-runtime" as const,
      nodeId: "a",
      runtime: { isLoading: false },
    };
    const inverse = updateRuntimeInverse(sceneWithNode, action, { now: Date.now });
    expect(inverse).toEqual({
      type: "update-runtime",
      nodeId: "a",
      runtime: { isLoading: true },
    });
  });

  it("returns undefined when node does not exist in sceneBefore", () => {
    const action = {
      type: "update-runtime" as const,
      nodeId: "missing",
      runtime: { isLoading: true },
    };
    const inverse = updateRuntimeInverse(sceneWithNode, action, { now: Date.now });
    expect(inverse).toBeUndefined();
  });
});
