import { describe, expect, it } from "vitest";
import { HandlerError } from "../src/engine/error.js";
import { updateRuntimeEntry } from "../src/runtime/handlers/update-runtime.js";
import type { SceneGraph } from "../src/types.js";
import { makeScene } from "./helpers.js";

const sceneWithNode: SceneGraph = makeScene({
  root: { id: "root", type: "container", children: ["a"] },
  a: {
    id: "a",
    type: "container",
    parentId: "root",
    runtime: { isLoading: true, count: 5 },
  },
});

describe("updateRuntimeEntry.handler", () => {
  it("shallow-merges runtime state onto existing node runtime", () => {
    const action = {
      type: "update-runtime" as const,
      nodeId: "a",
      runtime: { isLoading: false },
    };
    const result = updateRuntimeEntry.handler(sceneWithNode, action, {
      now: Date.now,
    });
    expect(result.nodes.a?.runtime).toEqual({ isLoading: false, count: 5 });
    expect(result.version).toBe(1);
  });

  it("overwrites specific keys while preserving others", () => {
    const scene: SceneGraph = makeScene({
      root: { id: "root", type: "container", children: ["a"] },
      a: {
        id: "a",
        type: "container",
        parentId: "root",
        runtime: { a: 1, b: 2, c: 3 },
      },
    });
    const action = {
      type: "update-runtime" as const,
      nodeId: "a",
      runtime: { a: 10, c: 30 },
    };
    const result = updateRuntimeEntry.handler(scene, action, { now: Date.now });
    expect(result.nodes.a?.runtime).toEqual({ a: 10, b: 2, c: 30 });
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
    const result = updateRuntimeEntry.handler(scene, action, { now: Date.now });
    expect(result.nodes.a?.runtime).toEqual({ isLoading: true });
  });

  it("rejects update-runtime when node does not exist", () => {
    const action = {
      type: "update-runtime" as const,
      nodeId: "missing",
      runtime: { isLoading: true },
    };
    expect(() =>
      updateRuntimeEntry.handler(sceneWithNode, action, { now: Date.now }),
    ).toThrow(HandlerError);
    try {
      updateRuntimeEntry.handler(sceneWithNode, action, { now: Date.now });
    } catch (e) {
      expect((e as HandlerError).code).toBe("scene.node-not-found");
      expect((e as HandlerError).context.nodeId).toBe("missing");
    }
  });
});

describe("updateRuntimeEntry.inverse", () => {
  it("produces an update-runtime inverse that captures the full prior runtime state", () => {
    const action = {
      type: "update-runtime" as const,
      nodeId: "a",
      runtime: { isLoading: false },
    };
    const inverse = updateRuntimeEntry.inverse(sceneWithNode, action, {
      now: Date.now,
    });
    expect(inverse).toEqual({
      type: "update-runtime",
      nodeId: "a",
      runtime: { isLoading: true, count: 5 },
    });
  });

  it("returns undefined when node does not exist in sceneBefore", () => {
    const action = {
      type: "update-runtime" as const,
      nodeId: "missing",
      runtime: { isLoading: true },
    };
    const inverse = updateRuntimeEntry.inverse(sceneWithNode, action, {
      now: Date.now,
    });
    expect(inverse).toBeUndefined();
  });
});
