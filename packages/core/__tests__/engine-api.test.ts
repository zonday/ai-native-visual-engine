import { describe, expect, it } from "vitest";
import { createEngineAPI } from "../src/engine-api.js";
import { createRuntimeHistoryState } from "../src/runtime/history.js";
import { createDefaultRuntimeRegistries } from "../src/runtime/inverse.js";
import { createRuntimeCommandBus } from "../src/runtime/runtime-command-bus.js";
import type { PageId, SceneGraph } from "../src/types.js";
import { makeScene } from "./helpers.js";

describe("createEngineAPI", () => {
  function setup(customScene?: SceneGraph) {
    const scene =
      customScene ??
      makeScene({
        root: { id: "root", type: "container", children: ["a", "b"] },
        a: {
          id: "a",
          type: "text",
          parentId: "root",
          props: { text: "hello" },
          layout: { mode: "absolute", x: 10, y: 20 } as any,
          bindings: [{ key: "v", source: "s" }],
          style: { color: "red" },
        },
        b: {
          id: "b",
          type: "text",
          parentId: "root",
          visible: false,
          locked: true,
        },
      });

    const { handlerRegistry } = createDefaultRuntimeRegistries(() => ({
      ok: false,
      scene,
      error: { code: "fail", message: "noop" },
    }));
    const bus = createRuntimeCommandBus(handlerRegistry, [], scene, {
      now: Date.now,
    });
    const history = createRuntimeHistoryState();
    const api = createEngineAPI(
      () => bus.getScene(),
      "page-1" as PageId,
      bus,
      () => history,
    );

    return { api, bus };
  }

  // NodeAPI
  it("node.get returns existing node", () => {
    expect(setup().api.node.get("a")?.type).toBe("text");
  });

  it("node.get returns undefined for missing node", () => {
    expect(setup().api.node.get("missing")).toBeUndefined();
  });

  it("node.getParent returns parent", () => {
    expect(setup().api.node.getParent("a")?.id).toBe("root");
  });

  it("node.getChildren returns children array", () => {
    expect(
      setup()
        .api.node.getChildren("root")
        .map((n) => n.id),
    ).toEqual(["a", "b"]);
  });

  it("node.getChildren returns empty for leaf", () => {
    expect(setup().api.node.getChildren("a")).toEqual([]);
  });

  it("node.getProps returns props or empty object", () => {
    expect(setup().api.node.getProps("a")).toEqual({ text: "hello" });
    expect(setup().api.node.getProps("root")).toEqual({});
  });

  it("node.getLayout returns layout", () => {
    expect(setup().api.node.getLayout("a")).toBeDefined();
  });

  it("node.getBindings returns bindings or empty array", () => {
    expect(setup().api.node.getBindings("a")).toHaveLength(1);
    expect(setup().api.node.getBindings("root")).toEqual([]);
  });

  it("node.getStyle returns style or empty object", () => {
    expect(setup().api.node.getStyle("a")).toEqual({ color: "red" });
    expect(setup().api.node.getStyle("root")).toEqual({});
  });

  it("node.isVisible returns false for hidden node", () => {
    expect(setup().api.node.isVisible("b")).toBe(false);
  });

  it("node.isLocked returns true for locked node", () => {
    expect(setup().api.node.isLocked("b")).toBe(true);
  });

  it("node.exists checks node presence", () => {
    expect(setup().api.node.exists("root")).toBe(true);
    expect(setup().api.node.exists("missing")).toBe(false);
  });

  // SceneAPI
  it("scene returns root, page, version, all nodes", () => {
    const { api } = setup();
    expect(api.scene.getRoot().id).toBe("root");
    expect(api.scene.getActivePageId()).toBe("page-1");
    expect(api.scene.getSceneVersion()).toBe(0);
    expect(api.scene.getAllNodes()).toHaveLength(3);
  });

  it("scene.findNodes and findNodeByType filter correctly", () => {
    const { api } = setup();
    expect(api.scene.findNodes((n) => n.type === "text")).toHaveLength(2);
    expect(api.scene.findNodeByType("text")).toHaveLength(2);
  });

  // SelectionAPI
  it("selection operations modify selection via command bus", () => {
    const { api, bus } = setup();
    api.selection.select(["a"]);
    expect(bus.getScene().selection?.nodeIds).toEqual(["a"]);

    api.selection.addToSelection(["b"]);
    expect(bus.getScene().selection?.nodeIds).toEqual(["a", "b"]);

    api.selection.removeFromSelection(["a"]);
    expect(bus.getScene().selection?.nodeIds).toEqual(["b"]);

    api.selection.clearSelection();
    expect(bus.getScene().selection?.nodeIds).toEqual([]);
  });

  it("selection.select deduplicates", () => {
    const { api, bus } = setup();
    api.selection.select(["a", "a", "a"]);
    expect(bus.getScene().selection?.nodeIds).toEqual(["a"]);
  });

  it("selection.selectParent and selectChildren", () => {
    const { api, bus } = setup();
    api.selection.selectParent("a");
    expect(bus.getScene().selection?.nodeIds).toEqual(["root"]);
    api.selection.selectChildren("root");
    expect(bus.getScene().selection?.nodeIds).toEqual(["a", "b"]);
  });

  it("selection.selectAll excludes root", () => {
    const { api, bus } = setup();
    api.selection.selectAll();
    const sel = bus.getScene().selection?.nodeIds ?? [];
    expect(sel).not.toContain("root");
    expect(sel.length).toBeGreaterThan(0);
  });

  // DispatchAPI
  it("dispatch.createNode creates node", () => {
    const { api, bus } = setup();
    const result = api.dispatch.createNode({ id: "c", type: "text" }, "root");
    expect(result.ok).toBe(true);
    expect(bus.getScene().nodes.c).toBeDefined();
  });

  it("dispatch.removeNode removes node", () => {
    const { api, bus } = setup();
    const result = api.dispatch.removeNode("a");
    expect(result.ok).toBe(true);
    expect(bus.getScene().nodes.a).toBeUndefined();
  });

  it("dispatch.rejects create-node with invalid parent", () => {
    const result = setup().api.dispatch.createNode(
      { id: "x", type: "text" },
      "missing",
    );
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("scene.invalid-parent");
  });

  it("dispatch.rejects remove-node on locked node", () => {
    const result = setup().api.dispatch.removeNode("b");
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("scene.locked");
  });

  it("dispatch.rejects with missing node for update actions", () => {
    const { api } = setup();
    expect(api.dispatch.moveNode("missing", "root").ok).toBe(false);
    expect(api.dispatch.updateLayout("missing", {}).ok).toBe(false);
    expect(api.dispatch.updateProps("missing", {}).ok).toBe(false);
  });

  it("dispatch.moveNode, updateLayout, updateProps work", () => {
    const { api } = setup();
    expect(api.dispatch.moveNode("a", "root", 0).ok).toBe(true);
    expect(api.dispatch.updateLayout("a", { x: 100 }).ok).toBe(true);
    expect(api.dispatch.updateProps("a", { text: "updated" }).ok).toBe(true);
  });

  it("dispatch.updateStyle, updateBindings, updateRuntime, rotateNode work", () => {
    const { api } = setup();
    expect(api.dispatch.updateStyle("a", { color: "blue" }).ok).toBe(true);
    expect(api.dispatch.updateBindings("a", []).ok).toBe(true);
    expect(api.dispatch.updateRuntime("a", { loading: true }).ok).toBe(true);
    expect(api.dispatch.rotateNode("a", 45).ok).toBe(true);
  });

  // Subscribe
  it("subscribe returns unsubscribe function", () => {
    const { api } = setup();
    const unsub = api.subscribeToScene(() => {});
    expect(typeof unsub).toBe("function");
    unsub();
  });
});
