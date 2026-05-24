import { describe, it, expect } from "vitest";
import type { SceneGraph, SceneNode } from "../src/types.js";
import type { RuntimeAction } from "../src/runtime/actions.js";
import type { RuntimeContext } from "../src/runtime/handler.js";
import type { InverseComputer } from "../src/runtime/inverse-registry.js";
import { createInverseRegistry, computeInverseAction } from "../src/runtime/inverse-registry.js";
import { createNodeInverse } from "../src/runtime/handlers/create-node.js";
import { removeNodeInverse } from "../src/runtime/handlers/remove-node.js";

const baseNode = (id: string, type = "container"): SceneNode => ({
  id,
  type,
});

const makeScene = (nodes: Record<string, SceneNode>, rootId = "root"): SceneGraph => ({
  version: 0,
  rootId,
  nodes,
});

const emptyScene: SceneGraph = makeScene({ root: { id: "root", type: "container", children: [] } });

const context: RuntimeContext = { now: Date.now };

describe("createInverseRegistry", () => {
  it("creates a registry from a record of inverse computers", () => {
    const registry = createInverseRegistry({
      "create-node": createNodeInverse as InverseComputer,
      "remove-node": removeNodeInverse as InverseComputer,
    });
    expect(registry.has("create-node")).toBe(true);
    expect(registry.has("remove-node")).toBe(true);
    expect(registry.has("move-node")).toBe(false);
  });
});

describe("computeInverseAction", () => {
  it("returns the inverse action for a registered action type", () => {
    const registry = createInverseRegistry({
      "create-node": createNodeInverse as InverseComputer,
    });
    const action: RuntimeAction = {
      type: "create-node",
      node: baseNode("child-1"),
      parentId: "root",
    };
    const inverse = computeInverseAction(registry, emptyScene, action, context);
    expect(inverse).toEqual({
      type: "remove-node",
      nodeId: "child-1",
    });
  });

  it("returns undefined for an unregistered action type", () => {
    const registry = createInverseRegistry({});
    const action: RuntimeAction = {
      type: "create-node",
      node: baseNode("child-1"),
      parentId: "root",
    };
    const inverse = computeInverseAction(registry, emptyScene, action, context);
    expect(inverse).toBeUndefined();
  });

  it("returns undefined when inverse computer returns undefined", () => {
    const registry = createInverseRegistry({
      "remove-node": removeNodeInverse as InverseComputer,
    });
    const action: RuntimeAction = {
      type: "remove-node",
      nodeId: "missing",
    };
    const inverse = computeInverseAction(registry, emptyScene, action, context);
    expect(inverse).toBeUndefined();
  });
});
