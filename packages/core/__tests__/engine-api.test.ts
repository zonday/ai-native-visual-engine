import { describe, it, expect } from "vitest";
import type { SceneGraph, SceneNode, PageId } from "../src/types.js";
import {
  createEngineAPI,
} from "../src/engine-api.js";
import { createRuntimeCommandBus } from "../src/runtime/runtime-command-bus.js";
import { createDefaultRuntimeRegistries } from "../src/runtime/inverse.js";
import { createRuntimeHistoryState } from "../src/runtime/history.js";
import { createEmptyScene } from "../src/bootstrap.js";

function makeScene(nodes: Record<string, SceneNode>): SceneGraph {
  return { version: 0, rootId: "root", nodes };
}

describe("createEngineAPI", () => {
  function setup(customScene?: SceneGraph) {
    const scene = customScene ?? makeScene({
      root: { id: "root", type: "container", children: ["a", "b"] },
      a: { id: "a", type: "text", parentId: "root", props: { text: "hello" }, layout: { mode: "absolute", x: 10, y: 20 } as any, bindings: [{ key: "v", source: "s" }], style: { color: "red" } },
      b: { id: "b", type: "text", parentId: "root", visible: false, locked: true },
    });

    const { handlerRegistry } = createDefaultRuntimeRegistries(
      () => ({ ok: false, scene, error: { code: "fail", message: "noop" } }),
    );
    const bus = createRuntimeCommandBus(handlerRegistry, [], scene, { now: Date.now });
    const history = createRuntimeHistoryState();
    const api = createEngineAPI(() => bus.getScene(), "page-1" as PageId, bus, () => history);

    return { scene, bus, history, api };
  }

  // NodeAPI
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
    expect(api.node.getChildren("root").map((n) => n.id)).toEqual(["a", "b"]);
  });

  it("node.getChildren returns empty for leaf", () => {
    const { api } = setup();
    expect(api.node.getChildren("a")).toEqual([]);
  });

  it("node.getProps returns props", () => {
    const { api } = setup();
    expect(api.node.getProps("a")).toEqual({ text: "hello" });
  });

  it("node.getProps returns empty object when none", () => {
    const { api } = setup();
    expect(api.node.getProps("root")).toEqual({});
  });

  it("node.getLayout returns layout", () => {
    const { api } = setup();
    expect(api.node.getLayout("a")).toBeDefined();
  });

  it("node.getBindings returns bindings", () => {
    const { api } = setup();
    expect(api.node.getBindings("a")).toHaveLength(1);
  });

  it("node.getBindings returns empty array when none", () => {
    const { api } = setup();
    expect(api.node.getBindings("root")).toEqual([]);
  });

  it("node.getStyle returns style", () => {
    const { api } = setup();
    expect(api.node.getStyle("a")).toEqual({ color: "red" });
  });

  it("node.isVisible returns false for hidden node", () => {
    const { api } = setup();
    expect(api.node.isVisible("b")).toBe(false);
  });

  it("node.isVisible returns true by default", () => {
    const { api } = setup();
    expect(api.node.isVisible("a")).toBe(true);
  });

  it("node.isLocked returns true for locked node", () => {
    const { api } = setup();
    expect(api.node.isLocked("b")).toBe(true);
  });

  it("node.isLocked returns false for unlocked", () => {
    const { api } = setup();
    expect(api.node.isLocked("a")).toBe(false);
  });

  it("node.exists returns true for existing nodes", () => {
    const { api } = setup();
    expect(api.node.exists("root")).toBe(true);
    expect(api.node.exists("missing")).toBe(false);
  });

  // SceneAPI
  it("scene.getRoot returns root node", () => {
    const { api } = setup();
    expect(api.scene.getRoot().id).toBe("root");
  });

  it("scene.getActivePageId returns page id", () => {
    const { api } = setup();
    expect(api.scene.getActivePageId()).toBe("page-1");
  });

  it("scene.getSceneVersion returns version", () => {
    const { api } = setup();
    expect(api.scene.getSceneVersion()).toBe(0);
  });

  it("scene.getAllNodes returns all nodes", () => {
    const { api } = setup();
    expect(api.scene.getAllNodes()).toHaveLength(3);
  });

  it("scene.findNodes filters by predicate", () => {
    const { api } = setup();
    expect(api.scene.findNodes((n) => n.type === "text")).toHaveLength(2);
  });

  it("scene.findNodeByType finds by type", () => {
    const { api } = setup();
    expect(api.scene.findNodeByType("text")).toHaveLength(2);
  });

  // SelectionAPI
  it("selection.isSelected returns selection state", () => {
    const { api } = setup();
    expect(api.selection.isSelected("a")).toBe(false);
  });

  it("selection.getSelection returns empty by default", () => {
    const { api } = setup();
    expect(api.selection.getSelection()).toEqual([]);
  });

  it("selection.select dispatches update-selection", () => {
    const { api, bus } = setup();
    api.selection.select(["a"]);
    expect(bus.getScene().selection?.nodeIds).toEqual(["a"]);
  });

  it("selection.addToSelection appends", () => {
    const { api, bus } = setup();
    api.selection.select(["a"]);
    api.selection.addToSelection(["b"]);
    expect(bus.getScene().selection?.nodeIds).toEqual(["a", "b"]);
  });

  it("selection.removeFromSelection removes", () => {
    const { api, bus } = setup();
    api.selection.select(["a", "b"]);
    api.selection.removeFromSelection(["a"]);
    expect(bus.getScene().selection?.nodeIds).toEqual(["b"]);
  });

  it("selection.clearSelection clears all", () => {
    const { api, bus } = setup();
    api.selection.select(["a", "b"]);
    api.selection.clearSelection();
    expect(bus.getScene().selection?.nodeIds).toEqual([]);
  });

  it("selection.selectParent selects parent", () => {
    const { api, bus } = setup();
    api.selection.selectParent("a");
    expect(bus.getScene().selection?.nodeIds).toEqual(["root"]);
  });

  it("selection.selectChildren selects children", () => {
    const { api, bus } = setup();
    api.selection.selectChildren("root");
    expect(bus.getScene().selection?.nodeIds).toEqual(["a", "b"]);
  });

  it("selection.selectAll selects all except root", () => {
    const { api, bus } = setup();
    api.selection.selectAll();
    expect(bus.getScene().selection?.nodeIds).not.toContain("root");
    expect(bus.getScene().selection?.nodeIds.length).toBeGreaterThan(0);
  });

  it("selection.select deduplicates", () => {
    const { api, bus } = setup();
    api.selection.select(["a", "a", "a"]);
    expect(bus.getScene().selection?.nodeIds).toEqual(["a"]);
  });

  // DispatchAPI
  it("dispatch.createNode dispatches correctly", () => {
    const { api } = setup();
    const result = api.dispatch.createNode({ id: "c", type: "text" }, "root");
    expect(result.ok).toBe(true);
  });

  it("dispatch.removeNode dispatches correctly", () => {
    const { api } = setup();
    const result = api.dispatch.removeNode("a");
    expect(result.ok).toBe(true);
  });

  it("dispatch.rejects create-node with invalid parent", () => {
    const { api } = setup();
    const result = api.dispatch.createNode({ id: "x", type: "text" }, "missing");
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("scene.invalid-parent");
  });

  it("dispatch.rejects remove-node on locked node", () => {
    const { api } = setup();
    const result = api.dispatch.removeNode("b");
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("scene.locked");
  });

  // HistoryAPI
  it("history reports empty stacks initially", () => {
    const { api } = setup();
    expect(api.history.canUndo()).toBe(false);
    expect(api.history.canRedo()).toBe(false);
  });

  it("history.getUndoStackSize returns size", () => {
    const { api } = setup();
    expect(api.history.getUndoStackSize()).toBe(0);
  });

  // StateAPI
  it("state.getActiveStates returns empty by default", () => {
    const { api } = setup();
    expect(api.states.getActiveStates("a")).toEqual([]);
  });

  // Subscribe
  it("subscribe returns unsubscribe function", () => {
    const { api } = setup();
    const unsub = api.subscribeToScene(() => { });
    expect(typeof unsub).toBe("function");
    unsub();
  });

  it("subscribeToNode unsubscribes correctly", () => {
    const { api } = setup();
    const unsub = api.subscribeToNode("a", () => {});
    expect(typeof unsub).toBe("function");
    unsub();
  });

  it("subscribeToSelection unsubscribes correctly", () => {
    const { api } = setup();
    const unsub = api.subscribeToSelection(() => {});
    expect(typeof unsub).toBe("function");
    unsub();
  });
});
