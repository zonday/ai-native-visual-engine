import { describe, it, expect } from "vitest";
import { updateSelectionHandler, updateSelectionInverse } from "../src/runtime/handlers/update-selection.js";
import { RuntimeHandlerError } from "../src/runtime/error.js";
import type { SceneGraph } from "../src/types.js";
import { makeScene, baseNode } from "./helpers.js";

const sceneWithNodes: SceneGraph = makeScene({
  root: { id: "root", type: "container", children: ["a", "b"] },
  a: { id: "a", type: "container", parentId: "root" },
  b: { id: "b", type: "container", parentId: "root" },
});

describe("updateSelectionHandler", () => {
  it("updates selection with valid nodeIds", () => {
    const action = {
      type: "update-selection" as const,
      nodeIds: ["a", "b"],
    };
    const result = updateSelectionHandler(sceneWithNodes, action, { now: Date.now });
    expect(result.selection).toEqual({ nodeIds: ["a", "b"] });
    expect(result.version).toBe(0);
  });

  it("clears selection when nodeIds is empty", () => {
    const scene: SceneGraph = { ...sceneWithNodes, selection: { nodeIds: ["a"] } };
    const action = {
      type: "update-selection" as const,
      nodeIds: [],
    };
    const result = updateSelectionHandler(scene, action, { now: Date.now });
    expect(result.selection).toEqual({ nodeIds: [] });
  });

  it("rejects update-selection when nodeIds contains duplicates", () => {
    const action = {
      type: "update-selection" as const,
      nodeIds: ["a", "a"],
    };
    expect(() => updateSelectionHandler(sceneWithNodes, action, { now: Date.now })).toThrow(
      RuntimeHandlerError,
    );
    try {
      updateSelectionHandler(sceneWithNodes, action, { now: Date.now });
    } catch (e) {
      expect((e as RuntimeHandlerError).code).toBe("scene.duplicate-selection");
    }
  });

  it("rejects update-selection when a nodeId does not exist in the scene", () => {
    const action = {
      type: "update-selection" as const,
      nodeIds: ["a", "missing"],
    };
    expect(() => updateSelectionHandler(sceneWithNodes, action, { now: Date.now })).toThrow(
      RuntimeHandlerError,
    );
    try {
      updateSelectionHandler(sceneWithNodes, action, { now: Date.now });
    } catch (e) {
      expect((e as RuntimeHandlerError).code).toBe("scene.node-not-found");
    }
  });
});

describe("updateSelectionInverse", () => {
  it("produces an update-selection inverse with the previous selection", () => {
    const scene: SceneGraph = { ...sceneWithNodes, selection: { nodeIds: ["a"] } };
    const action = {
      type: "update-selection" as const,
      nodeIds: ["b"],
    };
    const inverse = updateSelectionInverse(scene, action, { now: Date.now });
    expect(inverse).toEqual({
      type: "update-selection",
      nodeIds: ["a"],
    });
  });

  it("returns the previous selection as inverse even when scene has no selection", () => {
    const action = {
      type: "update-selection" as const,
      nodeIds: ["a"],
    };
    const inverse = updateSelectionInverse(sceneWithNodes, action, { now: Date.now });
    expect(inverse).toEqual({
      type: "update-selection",
      nodeIds: [],
    });
  });
});
