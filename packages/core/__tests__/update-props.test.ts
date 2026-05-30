import { describe, expect, it } from "vitest";
import { HandlerError } from "../src/engine/error.js";
import { updatePropsEntry } from "../src/runtime/handlers/update-props.js";
import type { SceneGraph } from "../src/types.js";
import { makeScene } from "./helpers.js";

const sceneWithNode: SceneGraph = makeScene({
  root: { id: "root", type: "container", children: ["a"] },
  a: {
    id: "a",
    type: "container",
    parentId: "root",
    props: { label: "Hello", count: 1 },
  },
});

describe("updatePropsEntry.handler", () => {
  it("shallow-merges props onto existing node props", () => {
    const action = {
      type: "update-props" as const,
      nodeId: "a",
      props: { label: "World" },
    };
    const result = updatePropsEntry.handler(sceneWithNode, action, {
      now: Date.now,
    });
    expect(result.nodes.a?.props).toEqual({ label: "World", count: 1 });
    expect(result.version).toBe(1);
  });

  it("overwrites specific keys while preserving others", () => {
    const scene: SceneGraph = makeScene({
      root: { id: "root", type: "container", children: ["a"] },
      a: {
        id: "a",
        type: "container",
        parentId: "root",
        props: { x: 1, y: 2, z: 3 },
      },
    });
    const action = {
      type: "update-props" as const,
      nodeId: "a",
      props: { x: 10, z: 30 },
    };
    const result = updatePropsEntry.handler(scene, action, { now: Date.now });
    expect(result.nodes.a?.props).toEqual({ x: 10, y: 2, z: 30 });
  });

  it("adds new props when node has no existing props", () => {
    const scene: SceneGraph = makeScene({
      root: { id: "root", type: "container", children: ["a"] },
      a: { id: "a", type: "container", parentId: "root" },
    });
    const action = {
      type: "update-props" as const,
      nodeId: "a",
      props: { label: "Hello" },
    };
    const result = updatePropsEntry.handler(scene, action, { now: Date.now });
    expect(result.nodes.a?.props).toEqual({ label: "Hello" });
  });

  it("rejects update-props when node does not exist", () => {
    const action = {
      type: "update-props" as const,
      nodeId: "missing",
      props: { label: "Hello" },
    };
    expect(() =>
      updatePropsEntry.handler(sceneWithNode, action, { now: Date.now }),
    ).toThrow(HandlerError);
    try {
      updatePropsEntry.handler(sceneWithNode, action, { now: Date.now });
    } catch (e) {
      expect((e as HandlerError).code).toBe("scene.node-not-found");
      expect((e as HandlerError).context.nodeId).toBe("missing");
    }
  });
});

describe("updatePropsEntry.inverse", () => {
  it("produces an update-props inverse that captures the full prior props state", () => {
    const action = {
      type: "update-props" as const,
      nodeId: "a",
      props: { label: "World" },
    };
    const inverse = updatePropsEntry.inverse(sceneWithNode, action, {
      now: Date.now,
    });
    expect(inverse).toEqual({
      type: "update-props",
      nodeId: "a",
      props: { label: "Hello", count: 1 },
    });
  });

  it("returns undefined when node does not exist in sceneBefore", () => {
    const action = {
      type: "update-props" as const,
      nodeId: "missing",
      props: { label: "Hello" },
    };
    const inverse = updatePropsEntry.inverse(sceneWithNode, action, {
      now: Date.now,
    });
    expect(inverse).toBeUndefined();
  });
});
