import { describe, expect, it } from "vitest";
import { HandlerError } from "../src/engine/error.js";
import { updateStyleEntry } from "../src/runtime/handlers/update-style.js";
import type { SceneGraph } from "../src/types.js";
import { makeScene } from "./helpers.js";

const sceneWithNode: SceneGraph = makeScene({
  root: { id: "root", type: "container", children: ["a"] },
  a: {
    id: "a",
    type: "container",
    parentId: "root",
    style: { color: "red", fontSize: 14 },
  },
});

describe("updateStyleEntry.handler", () => {
  it("replaces the entire style object on the target node", () => {
    const action = {
      type: "update-style" as const,
      nodeId: "a",
      style: { color: "blue" },
    };
    const result = updateStyleEntry.handler(sceneWithNode, action, {
      now: Date.now,
    });
    expect(result.nodes.a?.style).toEqual({ color: "blue" });
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
    const result = updateStyleEntry.handler(scene, action, { now: Date.now });
    expect(result.nodes.a?.style).toEqual({ color: "green" });
  });

  it("rejects update-style when node does not exist", () => {
    const action = {
      type: "update-style" as const,
      nodeId: "missing",
      style: { color: "blue" },
    };
    expect(() =>
      updateStyleEntry.handler(sceneWithNode, action, { now: Date.now }),
    ).toThrow(HandlerError);
    try {
      updateStyleEntry.handler(sceneWithNode, action, { now: Date.now });
    } catch (e) {
      expect((e as HandlerError).code).toBe("scene.node-not-found");
      expect((e as HandlerError).context.nodeId).toBe("missing");
    }
  });
});

describe("updateStyleEntry.inverse", () => {
  it("produces an update-style inverse with the original style", () => {
    const action = {
      type: "update-style" as const,
      nodeId: "a",
      style: { color: "blue" },
    };
    const inverse = updateStyleEntry.inverse(sceneWithNode, action, {
      now: Date.now,
    });
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
    const inverse = updateStyleEntry.inverse(sceneWithNode, action, {
      now: Date.now,
    });
    expect(inverse).toBeUndefined();
  });
});
