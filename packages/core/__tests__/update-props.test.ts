import { describe, it, expect } from "vitest";
import { updatePropsHandler, updatePropsInverse } from "../src/runtime/handlers/update-props.js";
import { RuntimeHandlerError } from "../src/runtime/error.js";
import type { SceneGraph } from "../src/types.js";
import { makeScene, baseNode } from "./helpers.js";

const sceneWithNode: SceneGraph = makeScene({
  root: { id: "root", type: "container", children: ["a"] },
  a: { id: "a", type: "container", parentId: "root", props: { label: "Hello", count: 1 } },
});

describe("updatePropsHandler", () => {
  it("replaces props entirely", () => {
    const action = {
      type: "update-props" as const,
      nodeId: "a",
      props: { label: "World" },
    };
    const result = updatePropsHandler(sceneWithNode, action, { now: Date.now });
    expect(result.nodes["a"]?.props).toEqual({ label: "World" });
    expect(result.version).toBe(1);
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
    const result = updatePropsHandler(scene, action, { now: Date.now });
    expect(result.nodes["a"]?.props).toEqual({ label: "Hello" });
  });

  it("rejects update-props when node does not exist", () => {
    const action = {
      type: "update-props" as const,
      nodeId: "missing",
      props: { label: "Hello" },
    };
    expect(() => updatePropsHandler(sceneWithNode, action, { now: Date.now })).toThrow(
      RuntimeHandlerError,
    );
    try {
      updatePropsHandler(sceneWithNode, action, { now: Date.now });
    } catch (e) {
      expect((e as RuntimeHandlerError).code).toBe("scene.node-not-found");
      expect((e as RuntimeHandlerError).context.nodeId).toBe("missing");
    }
  });
});

describe("updatePropsInverse", () => {
  it("produces an update-props inverse that captures the full prior props state", () => {
    const action = {
      type: "update-props" as const,
      nodeId: "a",
      props: { label: "World" },
    };
    const inverse = updatePropsInverse(sceneWithNode, action, { now: Date.now });
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
    const inverse = updatePropsInverse(sceneWithNode, action, { now: Date.now });
    expect(inverse).toBeUndefined();
  });
});
