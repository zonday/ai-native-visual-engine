import { describe, expect, it } from "vitest";
import type { RuntimeAction } from "../src/runtime/actions.js";
import type { RuntimeContext } from "../src/runtime/handler-registry.js";
import { createNodeEntry } from "../src/runtime/handlers/create-node.js";
import { moveNodeEntry } from "../src/runtime/handlers/move-node.js";
import { removeNodeEntry } from "../src/runtime/handlers/remove-node.js";
import { rotateNodeEntry } from "../src/runtime/handlers/rotate-node.js";
import { updateBindingsEntry } from "../src/runtime/handlers/update-bindings.js";
import { updateLayoutEntry } from "../src/runtime/handlers/update-layout.js";
import { updatePropsEntry } from "../src/runtime/handlers/update-props.js";
import { updateRuntimeEntry } from "../src/runtime/handlers/update-runtime.js";
import { updateSelectionEntry } from "../src/runtime/handlers/update-selection.js";
import { updateStyleEntry } from "../src/runtime/handlers/update-style.js";
import type { AbsoluteLayout, SceneGraph } from "../src/types.js";
import { baseNode, makeScene } from "./helpers.js";

const context: RuntimeContext = { now: Date.now };

const runtimeHandlers = {
  "create-node": createNodeEntry.handler,
  "remove-node": removeNodeEntry.handler,
  "move-node": moveNodeEntry.handler,
  "update-layout": updateLayoutEntry.handler,
  "rotate-node": rotateNodeEntry.handler,
  "update-props": updatePropsEntry.handler,
  "update-style": updateStyleEntry.handler,
  "update-bindings": updateBindingsEntry.handler,
  "update-runtime": updateRuntimeEntry.handler,
  "update-selection": updateSelectionEntry.handler,
} as unknown as Record<
  string,
  (scene: SceneGraph, action: RuntimeAction, ctx: RuntimeContext) => SceneGraph
>;

function roundTrip<TAction extends RuntimeAction>(
  sceneBefore: SceneGraph,
  action: TAction,
  handler: (
    scene: SceneGraph,
    action: TAction,
    ctx: RuntimeContext,
  ) => SceneGraph,
  inverseComputer: (
    sceneBefore: SceneGraph,
    action: TAction,
    ctx: RuntimeContext,
  ) => RuntimeAction | undefined,
): {
  sceneAfter: SceneGraph;
  inverse: RuntimeAction | undefined;
  sceneRestored: SceneGraph;
} {
  const sceneAfter = handler(sceneBefore, action, context);
  const inverse = inverseComputer(sceneBefore, action, context);
  if (!inverse) {
    return { sceneAfter, inverse: undefined, sceneRestored: sceneAfter };
  }
  const inverseHandler = runtimeHandlers[inverse.type];
  if (!inverseHandler) {
    return { sceneAfter, inverse, sceneRestored: sceneAfter };
  }
  const sceneRestored = inverseHandler(sceneAfter, inverse, context);
  return { sceneAfter, inverse, sceneRestored };
}

describe("inverse round-trip: create-node -> remove-node", () => {
  it("restores the scene after creating and then removing a node", () => {
    const sceneBefore: SceneGraph = makeScene({
      root: { id: "root", type: "container", children: [] },
    });
    const action: RuntimeAction = {
      type: "create-node",
      node: baseNode("child-1"),
      parentId: "root",
    };
    const { sceneAfter, inverse, sceneRestored } = roundTrip(
      sceneBefore,
      action,
      createNodeEntry.handler,
      createNodeEntry.inverse,
    );
    expect(sceneAfter.nodes["child-1"]).toBeDefined();
    expect(inverse).toEqual({ type: "remove-node", nodeId: "child-1" });
    expect(sceneRestored.nodes["child-1"]).toBeUndefined();
    expect(sceneRestored.nodes.root?.children).toEqual([]);
  });
});

describe("inverse round-trip: remove-node -> create-node", () => {
  it("restores the scene after removing and then recreating a node", () => {
    const sceneBefore: SceneGraph = makeScene({
      root: { id: "root", type: "container", children: ["a"] },
      a: { id: "a", type: "container", parentId: "root" },
    });
    const action: RuntimeAction = {
      type: "remove-node",
      nodeId: "a",
    };
    const { sceneAfter, inverse, sceneRestored } = roundTrip(
      sceneBefore,
      action,
      removeNodeEntry.handler,
      removeNodeEntry.inverse,
    );
    expect(sceneAfter.nodes.a).toBeUndefined();
    expect(inverse?.type).toBe("create-node");
    expect(sceneRestored.nodes.a).toBeDefined();
    expect(sceneRestored.nodes.root?.children).toEqual(["a"]);
  });
});

describe("inverse round-trip: move-node -> move-node", () => {
  it("restores the scene after moving and then moving back a node", () => {
    const sceneBefore: SceneGraph = makeScene({
      root: { id: "root", type: "container", children: ["a", "b"] },
      a: { id: "a", type: "container", parentId: "root" },
      b: { id: "b", type: "container", parentId: "root" },
    });
    const action: RuntimeAction = {
      type: "move-node",
      nodeId: "a",
      parentId: "b",
    };
    const { sceneAfter, inverse, sceneRestored } = roundTrip(
      sceneBefore,
      action,
      moveNodeEntry.handler,
      moveNodeEntry.inverse,
    );
    expect(sceneAfter.nodes.a?.parentId).toBe("b");
    expect(inverse?.type).toBe("move-node");
    expect(sceneRestored.nodes.a?.parentId).toBe("root");
    expect(sceneRestored.nodes.root?.children).toEqual(["a", "b"]);
  });
});

describe("inverse round-trip: update-layout -> update-layout", () => {
  it("restores the scene after updating and then reverting layout", () => {
    const sceneBefore: SceneGraph = makeScene({
      root: { id: "root", type: "container", children: ["a"] },
      a: {
        id: "a",
        type: "container",
        parentId: "root",
        layout: { x: 0, y: 0 },
      },
    });
    const action: RuntimeAction = {
      type: "update-layout",
      nodeId: "a",
      layout: { x: 100 },
    };
    const { sceneAfter, inverse, sceneRestored } = roundTrip(
      sceneBefore,
      action,
      updateLayoutEntry.handler,
      updateLayoutEntry.inverse,
    );
    expect(sceneAfter.nodes.a?.layout).toEqual({ x: 100, y: 0 });
    expect(inverse?.type).toBe("update-layout");
    expect(sceneRestored.nodes.a?.layout).toEqual({ x: 0, y: 0 });
  });
});

describe("inverse round-trip: rotate-node -> rotate-node", () => {
  it("restores the scene after rotating and then reverting rotation", () => {
    const sceneBefore: SceneGraph = makeScene({
      root: { id: "root", type: "container", children: ["a"] },
      a: {
        id: "a",
        type: "container",
        parentId: "root",
        layout: { mode: "absolute", x: 0, y: 0, rotation: 0 },
      },
    });
    const action: RuntimeAction = {
      type: "rotate-node",
      nodeId: "a",
      rotation: 90,
    };
    const { sceneAfter, inverse, sceneRestored } = roundTrip(
      sceneBefore,
      action,
      rotateNodeEntry.handler,
      rotateNodeEntry.inverse,
    );
    expect((sceneAfter.nodes.a?.layout as AbsoluteLayout).rotation).toBe(90);
    expect(inverse?.type).toBe("rotate-node");
    expect((sceneRestored.nodes.a?.layout as AbsoluteLayout).rotation).toBe(0);
  });
});

describe("inverse round-trip: update-props -> update-props", () => {
  it("restores the scene after updating and then reverting props", () => {
    const sceneBefore: SceneGraph = makeScene({
      root: { id: "root", type: "container", children: ["a"] },
      a: {
        id: "a",
        type: "container",
        parentId: "root",
        props: { label: "Hello" },
      },
    });
    const action: RuntimeAction = {
      type: "update-props",
      nodeId: "a",
      props: { label: "World" },
    };
    const { sceneAfter, inverse, sceneRestored } = roundTrip(
      sceneBefore,
      action,
      updatePropsEntry.handler,
      updatePropsEntry.inverse,
    );
    expect(sceneAfter.nodes.a?.props).toEqual({ label: "World" });
    expect(inverse?.type).toBe("update-props");
    expect(sceneRestored.nodes.a?.props).toEqual({ label: "Hello" });
  });
});

describe("inverse round-trip: update-style -> update-style", () => {
  it("restores the scene after updating and then reverting style", () => {
    const sceneBefore: SceneGraph = makeScene({
      root: { id: "root", type: "container", children: ["a"] },
      a: {
        id: "a",
        type: "container",
        parentId: "root",
        style: { color: "red" },
      },
    });
    const action: RuntimeAction = {
      type: "update-style",
      nodeId: "a",
      style: { color: "blue" },
    };
    const { sceneAfter, inverse, sceneRestored } = roundTrip(
      sceneBefore,
      action,
      updateStyleEntry.handler,
      updateStyleEntry.inverse,
    );
    expect(sceneAfter.nodes.a?.style).toEqual({ color: "blue" });
    expect(inverse?.type).toBe("update-style");
    expect(sceneRestored.nodes.a?.style).toEqual({ color: "red" });
  });
});

describe("inverse round-trip: update-bindings -> update-bindings", () => {
  it("restores the scene after updating and then reverting bindings", () => {
    const binding1 = { key: "text", source: "state.x" };
    const binding2 = { key: "value", source: "state.y" };
    const sceneBefore: SceneGraph = makeScene({
      root: { id: "root", type: "container", children: ["a"] },
      a: { id: "a", type: "container", parentId: "root", bindings: [binding1] },
    });
    const action: RuntimeAction = {
      type: "update-bindings",
      nodeId: "a",
      bindings: [binding2],
    };
    const { sceneAfter, inverse, sceneRestored } = roundTrip(
      sceneBefore,
      action,
      updateBindingsEntry.handler,
      updateBindingsEntry.inverse,
    );
    expect(sceneAfter.nodes.a?.bindings).toEqual([binding2]);
    expect(inverse?.type).toBe("update-bindings");
    expect(sceneRestored.nodes.a?.bindings).toEqual([binding1]);
  });
});

describe("inverse round-trip: update-runtime -> update-runtime", () => {
  it("restores the scene after updating and then reverting runtime state", () => {
    const sceneBefore: SceneGraph = makeScene({
      root: { id: "root", type: "container", children: ["a"] },
      a: {
        id: "a",
        type: "container",
        parentId: "root",
        runtime: { isLoading: true },
      },
    });
    const action: RuntimeAction = {
      type: "update-runtime",
      nodeId: "a",
      runtime: { isLoading: false },
    };
    const { sceneAfter, inverse, sceneRestored } = roundTrip(
      sceneBefore,
      action,
      updateRuntimeEntry.handler,
      updateRuntimeEntry.inverse,
    );
    expect(sceneAfter.nodes.a?.runtime).toEqual({ isLoading: false });
    expect(inverse?.type).toBe("update-runtime");
    expect(sceneRestored.nodes.a?.runtime).toEqual({ isLoading: true });
  });
});

describe("inverse round-trip: update-selection -> update-selection", () => {
  it("restores the scene after updating and then reverting selection", () => {
    const sceneBefore: SceneGraph = {
      ...makeScene({
        root: { id: "root", type: "container", children: ["a", "b"] },
        a: { id: "a", type: "container", parentId: "root" },
        b: { id: "b", type: "container", parentId: "root" },
      }),
      selection: { nodeIds: ["a"] },
    };
    const action: RuntimeAction = {
      type: "update-selection",
      nodeIds: ["b"],
    };
    const { sceneAfter, inverse, sceneRestored } = roundTrip(
      sceneBefore,
      action,
      updateSelectionEntry.handler,
      updateSelectionEntry.inverse,
    );
    expect(sceneAfter.selection).toEqual({ nodeIds: ["b"] });
    expect(inverse?.type).toBe("update-selection");
    expect(sceneRestored.selection).toEqual({ nodeIds: ["a"] });
  });
});
