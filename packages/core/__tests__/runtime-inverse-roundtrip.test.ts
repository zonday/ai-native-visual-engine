import { describe, expect, it } from "vitest";
import type { RuntimeAction } from "../src/runtime/actions.js";
import type { RuntimeContext } from "../src/runtime/handler.js";
import {
  createNodeHandler,
  createNodeInverse,
} from "../src/runtime/handlers/create-node.js";
import {
  moveNodeHandler,
  moveNodeInverse,
} from "../src/runtime/handlers/move-node.js";
import {
  removeNodeHandler,
  removeNodeInverse,
} from "../src/runtime/handlers/remove-node.js";
import {
  rotateNodeHandler,
  rotateNodeInverse,
} from "../src/runtime/handlers/rotate-node.js";
import {
  updateBindingsHandler,
  updateBindingsInverse,
} from "../src/runtime/handlers/update-bindings.js";
import {
  updateLayoutHandler,
  updateLayoutInverse,
} from "../src/runtime/handlers/update-layout.js";
import {
  updatePropsHandler,
  updatePropsInverse,
} from "../src/runtime/handlers/update-props.js";
import {
  updateRuntimeHandler,
  updateRuntimeInverse,
} from "../src/runtime/handlers/update-runtime.js";
import {
  updateSelectionHandler,
  updateSelectionInverse,
} from "../src/runtime/handlers/update-selection.js";
import {
  updateStyleHandler,
  updateStyleInverse,
} from "../src/runtime/handlers/update-style.js";
import type { AbsoluteLayout, SceneGraph } from "../src/types.js";
import { baseNode, makeScene } from "./helpers.js";

const context: RuntimeContext = { now: Date.now };

const runtimeHandlers = {
  "create-node": createNodeHandler,
  "remove-node": removeNodeHandler,
  "move-node": moveNodeHandler,
  "update-layout": updateLayoutHandler,
  "rotate-node": rotateNodeHandler,
  "update-props": updatePropsHandler,
  "update-style": updateStyleHandler,
  "update-bindings": updateBindingsHandler,
  "update-runtime": updateRuntimeHandler,
  "update-selection": updateSelectionHandler,
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
      createNodeHandler,
      createNodeInverse,
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
      removeNodeHandler,
      removeNodeInverse,
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
      moveNodeHandler,
      moveNodeInverse,
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
      updateLayoutHandler,
      updateLayoutInverse,
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
      rotateNodeHandler,
      rotateNodeInverse,
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
      updatePropsHandler,
      updatePropsInverse,
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
      updateStyleHandler,
      updateStyleInverse,
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
      updateBindingsHandler,
      updateBindingsInverse,
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
      updateRuntimeHandler,
      updateRuntimeInverse,
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
      updateSelectionHandler,
      updateSelectionInverse,
    );
    expect(sceneAfter.selection).toEqual({ nodeIds: ["b"] });
    expect(inverse?.type).toBe("update-selection");
    expect(sceneRestored.selection).toEqual({ nodeIds: ["a"] });
  });
});
