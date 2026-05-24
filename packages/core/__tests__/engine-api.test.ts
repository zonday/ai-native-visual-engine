import { describe, it, expect } from "vitest";
import type { SceneGraph, SceneNode, PageId } from "../src/types.js";
import {
  createEngineAPI,
} from "../src/engine-api.js";
import { createRuntimeCommandBus } from "../src/runtime/runtime-command-bus.js";
import { createDefaultRuntimeRegistries } from "../src/runtime/inverse.js";
import { createRuntimeHistoryState } from "../src/runtime/history.js";
import type { RuntimeAction } from "../src/runtime/actions.js";
import { createEmptyScene } from "../src/bootstrap.js";

function makeScene(nodes: Record<string, SceneNode>): SceneGraph {
  return { version: 0, rootId: "root", nodes };
}

describe("createEngineAPI", () => {
  function setup() {
    const scene = makeScene({
      root: { id: "root", type: "container", children: ["a"] },
      a: { id: "a", type: "text", parentId: "root", props: { text: "hello" }, layout: { mode: "absolute", x: 10, y: 20 }, bindings: [] },
    });

    const { handlerRegistry } = createDefaultRuntimeRegistries(
      () => ({ ok: false, scene, error: { code: "fail", message: "noop" } }),
    );
    const bus = createRuntimeCommandBus(handlerRegistry, [], scene, { now: Date.now });
    const history = createRuntimeHistoryState();
    const api = createEngineAPI(() => scene, "page-1" as PageId, bus, () => history);

    return { scene, bus, history, api };
  }

  it("node.get returns existing node", () => {
    const { api } = setup();
    expect(api.node.get("a")?.type).toBe("text");
  });

  it("node.get returns undefined for missing node", () => {
    const { api } = setup();
    expect(api.node.get("missing")).toBeUndefined();
  });

  it("node.getParent returns parent", () => {
    const { api } = setup();
    expect(api.node.getParent("a")?.id).toBe("root");
  });

  it("node.getChildren returns children array", () => {
    const { api } = setup();
    expect(api.node.getChildren("root").map((n) => n.id)).toEqual(["a"]);
  });

  it("node.getProps returns props", () => {
    const { api } = setup();
    expect(api.node.getProps("a")).toEqual({ text: "hello" });
  });

  it("node.isVisible returns true by default", () => {
    const { api } = setup();
    expect(api.node.isVisible("a")).toBe(true);
  });

  it("node.exists returns true for existing nodes", () => {
    const { api } = setup();
    expect(api.node.exists("root")).toBe(true);
    expect(api.node.exists("missing")).toBe(false);
  });

  it("scene.getRoot returns root node", () => {
    const { api } = setup();
    expect(api.scene.getRoot().id).toBe("root");
  });

  it("scene.getAllNodes returns all nodes", () => {
    const { api } = setup();
    expect(api.scene.getAllNodes()).toHaveLength(2);
  });

  it("selection.isSelected returns selection state", () => {
    const { api } = setup();
    expect(api.selection.isSelected("a")).toBe(false);
  });

  it("selection.getSelection returns empty by default", () => {
    const { api } = setup();
    expect(api.selection.getSelection()).toEqual([]);
  });

  it("dispatch.createNode dispatches correctly", () => {
    const { api, bus } = setup();
    const result = api.dispatch.createNode(
      { id: "b", type: "text" },
      "root",
    );
    expect(result.ok).toBe(true);
  });

  it("history reports empty stacks initially", () => {
    const { api } = setup();
    expect(api.history.canUndo()).toBe(false);
    expect(api.history.canRedo()).toBe(false);
  });

  it("subscribe returns unsubscribe function", () => {
    const { api } = setup();
    const unsub = api.subscribeToScene(() => {});
    expect(typeof unsub).toBe("function");
    unsub();
  });
});
