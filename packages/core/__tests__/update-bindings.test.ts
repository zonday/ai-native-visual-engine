import { describe, expect, it } from "vitest";
import { HandlerError } from "../src/engine/error.js";
import { updateBindingsEntry } from "../src/runtime/handlers/update-bindings.js";
import type { Binding, SceneGraph } from "../src/types.js";
import { makeScene } from "./helpers.js";

const binding1: Binding = { key: "text", source: "state.count" };
const binding2: Binding = { key: "value", source: "state.name" };

const sceneWithNode: SceneGraph = makeScene({
  root: { id: "root", type: "container", children: ["a"] },
  a: { id: "a", type: "container", parentId: "root", bindings: [binding1] },
});

describe("updateBindingsEntry.handler", () => {
  it("replaces all bindings on the target node", () => {
    const action = {
      type: "update-bindings" as const,
      nodeId: "a",
      bindings: [binding2],
    };
    const result = updateBindingsEntry.handler(sceneWithNode, action, {
      now: Date.now,
    });
    expect(result.nodes.a?.bindings).toEqual([binding2]);
    expect(result.version).toBe(1);
  });

  it("sets bindings on node that has no existing bindings", () => {
    const scene: SceneGraph = makeScene({
      root: { id: "root", type: "container", children: ["a"] },
      a: { id: "a", type: "container", parentId: "root" },
    });
    const action = {
      type: "update-bindings" as const,
      nodeId: "a",
      bindings: [binding1],
    };
    const result = updateBindingsEntry.handler(scene, action, {
      now: Date.now,
    });
    expect(result.nodes.a?.bindings).toEqual([binding1]);
  });

  it("rejects update-bindings when node does not exist", () => {
    const action = {
      type: "update-bindings" as const,
      nodeId: "missing",
      bindings: [],
    };
    expect(() =>
      updateBindingsEntry.handler(sceneWithNode, action, { now: Date.now }),
    ).toThrow(HandlerError);
    try {
      updateBindingsEntry.handler(sceneWithNode, action, { now: Date.now });
    } catch (e) {
      expect((e as HandlerError).code).toBe("scene.node-not-found");
      expect((e as HandlerError).context.nodeId).toBe("missing");
    }
  });
});

describe("updateBindingsEntry.inverse", () => {
  it("produces an update-bindings inverse with the original bindings", () => {
    const action = {
      type: "update-bindings" as const,
      nodeId: "a",
      bindings: [binding2],
    };
    const inverse = updateBindingsEntry.inverse(sceneWithNode, action, {
      now: Date.now,
    });
    expect(inverse).toEqual({
      type: "update-bindings",
      nodeId: "a",
      bindings: [binding1],
    });
  });

  it("returns undefined when node does not exist in sceneBefore", () => {
    const action = {
      type: "update-bindings" as const,
      nodeId: "missing",
      bindings: [],
    };
    const inverse = updateBindingsEntry.inverse(sceneWithNode, action, {
      now: Date.now,
    });
    expect(inverse).toBeUndefined();
  });
});
