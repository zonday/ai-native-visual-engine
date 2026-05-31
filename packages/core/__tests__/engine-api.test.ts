import { describe, expect, it } from "vitest";
import { createEngine } from "../src/engine/factory.js";
import { createHistoryState } from "../src/engine/history.js";
import type { RuntimeAction } from "../src/runtime/register-handlers.js";

const createRuntimeHistoryState = createHistoryState<RuntimeAction>;

import type { Middleware } from "../src/engine/command-bus.js";
import type { RuntimeContext } from "../src/engine/handler.js";
import { createUndoHistoryMiddleware } from "../src/engine/history-middleware.js";
import { createRuntimeRegistry } from "../src/runtime/register-handlers.js";
import { createRuntimeCommandBus } from "../src/runtime/runtime-command-bus.js";
import type { SceneGraph } from "../src/types.js";
import { makeScene } from "./helpers.js";

describe("createEngine", () => {
  function setup(
    customScene?: SceneGraph,
    opts?: { withTx?: boolean; withHistory?: boolean },
  ) {
    const scene =
      customScene ??
      makeScene({
        root: { id: "root", type: "container", children: ["a", "b"] },
        a: {
          id: "a",
          type: "text",
          parentId: "root",
          props: { text: "hello" },
          layout: { mode: "absolute" as const, x: 10, y: 20 },
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

    const runtimeReg = createRuntimeRegistry();
    const history = createRuntimeHistoryState();
    const middlewares: Middleware<SceneGraph, RuntimeAction>[] = [];

    if (opts?.withHistory) {
      middlewares.push(
        createUndoHistoryMiddleware<SceneGraph, RuntimeAction, RuntimeContext>(
          () => history,
          (s) => {
            Object.assign(history, s);
          },
          () => undefined,
          runtimeReg,
          () => ({ now: Date.now }),
        ),
      );
    }

    const bus = createRuntimeCommandBus(runtimeReg, middlewares, scene, {
      now: Date.now,
    });
    const api = createEngine(
      () => bus.getScene(),
      bus,
      () => history,
      opts?.withHistory
        ? (s) => {
            Object.assign(history, s);
          }
        : undefined,
      opts?.withTx ? runtimeReg : undefined,
    );

    return { api, bus, history };
  }

  // NodeQuery
  it("selector.getNode returns existing node", () => {
    expect(setup().api.selector.getNode("a")?.type).toBe("text");
  });

  it("selector.getNode returns undefined for missing node", () => {
    expect(setup().api.selector.getNode("missing")).toBeUndefined();
  });

  it("selector.getParent returns parent", () => {
    expect(setup().api.selector.getParent("a")?.id).toBe("root");
  });

  it("selector.getChildren returns children array", () => {
    expect(
      setup()
        .api.selector.getChildren("root")
        .map((n) => n.id),
    ).toEqual(["a", "b"]);
  });

  it("selector.getChildren returns empty for leaf", () => {
    expect(setup().api.selector.getChildren("a")).toEqual([]);
  });

  it("selector.getNodeProps returns props or undefined", () => {
    expect(setup().api.selector.getNodeProps("a")).toEqual({
      text: "hello",
    });
    expect(setup().api.selector.getNodeProps("root")).toBeUndefined();
  });

  it("selector.getNodeLayout returns layout", () => {
    expect(setup().api.selector.getNodeLayout("a")).toBeDefined();
  });

  it("selector.getBindings returns bindings or empty array", () => {
    expect(setup().api.selector.getBindings("a")).toHaveLength(1);
    expect(setup().api.selector.getBindings("root")).toEqual([]);
  });

  it("selector.getStyle returns style or empty object", () => {
    expect(setup().api.selector.getStyle("a")).toEqual({ color: "red" });
    expect(setup().api.selector.getStyle("root")).toEqual({});
  });

  it("selector.getNodeVisibility returns false for hidden node", () => {
    expect(setup().api.selector.getNodeVisibility("b")).toBe(false);
  });

  it("selector.isLocked returns true for locked node", () => {
    expect(setup().api.selector.isLocked("b")).toBe(true);
  });

  it("selector.getNode checks node presence", () => {
    expect(setup().api.selector.getNode("root")).toBeDefined();
    expect(setup().api.selector.getNode("missing")).toBeUndefined();
  });

  // SceneQuery
  it("selector returns root, version, all nodes", () => {
    const { api } = setup();
    expect(api.selector.getRoot().id).toBe("root");
    expect(api.selector.getVersion()).toBe(0);
    expect(api.selector.getAllNodes()).toHaveLength(3);
  });

  it("selector.findNodes filters correctly", () => {
    const { api } = setup();
    expect(api.selector.findNodes((n) => n.type === "text")).toHaveLength(2);
  });

  // SelectionQuery (read-only)
  it("selector reads current selection from scene", () => {
    const { api } = setup();
    expect(api.selector.getScene().selection?.nodeIds ?? []).toEqual([]);
    expect(
      api.selector.getScene().selection?.nodeIds.includes("a") === true,
    ).toBe(false);
  });

  // CommandService
  it("command creates node", () => {
    const { api, bus } = setup();
    const result = api.command({
      type: "create-node",
      node: { id: "c", type: "text" },
      parentId: "root",
    });
    expect(result.ok).toBe(true);
    expect(bus.getScene().nodes.c).toBeDefined();
  });

  it("command removes node", () => {
    const { api, bus } = setup();
    const result = api.command({ type: "remove-node", nodeId: "a" });
    expect(result.ok).toBe(true);
    expect(bus.getScene().nodes.a).toBeUndefined();
  });

  it("command rejects create-node with invalid parent", () => {
    const result = setup().api.command({
      type: "create-node",
      node: { id: "x", type: "text" },
      parentId: "missing",
    });
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("scene.invalid-parent");
  });

  it("command rejects remove-node on locked node", () => {
    const result = setup().api.command({
      type: "remove-node",
      nodeId: "b",
    });
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("scene.locked");
  });

  it("command rejects with missing node for update actions", () => {
    const { api } = setup();
    expect(
      api.command({
        type: "move-node",
        nodeId: "missing",
        parentId: "root",
      }).ok,
    ).toBe(false);
    expect(
      api.command({
        type: "update-layout",
        nodeId: "missing",
        layout: {},
      }).ok,
    ).toBe(false);
  });

  it("command move-node, update-layout, update-props work", () => {
    const { api } = setup();
    expect(
      api.command({
        type: "move-node",
        nodeId: "a",
        parentId: "root",
        index: 0,
      }).ok,
    ).toBe(true);
    expect(
      api.command({
        type: "update-layout",
        nodeId: "a",
        layout: { x: 100 },
      }).ok,
    ).toBe(true);
    expect(
      api.command({
        type: "update-props",
        nodeId: "a",
        props: { text: "updated" },
      }).ok,
    ).toBe(true);
  });

  it("selector descendant queries stay fresh after move-node", () => {
    const scene = makeScene({
      root: { id: "root", type: "container", children: ["a", "b"] },
      a: { id: "a", type: "container", parentId: "root", children: ["a1"] },
      a1: { id: "a1", type: "text", parentId: "a" },
      b: { id: "b", type: "container", parentId: "root", children: [] },
    });
    const { api } = setup(scene);

    expect(api.selector.isDescendantOf("a1", "a")).toBe(true);
    expect(api.selector.getDescendants("a")).toEqual(["a1"]);

    const result = api.command({
      type: "move-node",
      nodeId: "a1",
      parentId: "root",
      index: 1,
    });

    expect(result.ok).toBe(true);
    expect(api.selector.isDescendantOf("a1", "a")).toBe(false);
    expect(api.selector.isDescendantOf("a1", "root")).toBe(true);
    expect(api.selector.getDescendants("a")).toEqual([]);
  });

  it("command update-style, update-bindings, update-runtime, rotate-node work", () => {
    const { api } = setup();
    expect(
      api.command({
        type: "update-style",
        nodeId: "a",
        style: { color: "blue" },
      }).ok,
    ).toBe(true);
    expect(
      api.command({
        type: "update-bindings",
        nodeId: "a",
        bindings: [],
      }).ok,
    ).toBe(true);
    expect(
      api.command({
        type: "update-runtime",
        nodeId: "a",
        runtime: { loading: true },
      }).ok,
    ).toBe(true);
    expect(
      api.command({ type: "rotate-node", nodeId: "a", rotation: 45 }).ok,
    ).toBe(true);
  });

  it("selector style reads stay fresh after update-style", () => {
    const { api } = setup();

    expect(api.selector.getStyle("a")).toEqual({ color: "red" });

    const result = api.command({
      type: "update-style",
      nodeId: "a",
      style: { color: "blue" },
    });

    expect(result.ok).toBe(true);
    expect(api.selector.getStyle("a")).toEqual({ color: "blue" });
  });

  it("selector bindings reads stay fresh after update-bindings", () => {
    const { api } = setup();

    expect(api.selector.getBindings("a")).toEqual([{ key: "v", source: "s" }]);

    const result = api.command({
      type: "update-bindings",
      nodeId: "a",
      bindings: [{ key: "next", source: "dataset:sales" }],
    });

    expect(result.ok).toBe(true);
    expect(api.selector.getBindings("a")).toEqual([
      { key: "next", source: "dataset:sales" },
    ]);
  });

  // selection mutation through scene.command
  it("command updates selection", () => {
    const { api, bus } = setup();
    const result = api.command({
      type: "update-selection",
      nodeIds: ["a", "b"],
    });
    expect(result.ok).toBe(true);
    expect(bus.getScene().selection?.nodeIds).toEqual(["a", "b"]);
  });

  // EventBus
  it("events.on('scene') fires on dispatch", async () => {
    const { api } = setup();
    let fired = false;
    api.events.on("scene", () => {
      fired = true;
    });
    api.command({
      type: "update-props",
      nodeId: "a",
      props: { x: 1 },
    });
    await new Promise((r) => setTimeout(r, 0));
    expect(fired).toBe(true);
  });

  it("events.on('selection') fires on selection change", async () => {
    const { api } = setup();
    let fired = false;
    api.events.on("selection", () => {
      fired = true;
    });
    api.command({
      type: "update-selection",
      nodeIds: ["a"],
    });
    await new Promise((r) => setTimeout(r, 0));
    expect(fired).toBe(true);
  });

  it("events.on returns unsubscribe function", () => {
    const { api } = setup();
    const unsub = api.events.on("scene", () => {});
    expect(typeof unsub).toBe("function");
    unsub();
  });

  // StateService — replaced with manual update-runtime dispatch
  it("update-runtime sets activeStates via scene.command", () => {
    const { api, bus } = setup();
    const result = api.command({
      type: "update-runtime",
      nodeId: "a",
      runtime: { activeStates: ["hovered"] },
    });
    expect(result.ok).toBe(true);
    const rt = bus.getScene().nodes.a?.runtime as Record<string, unknown>;
    expect(rt.activeStates).toContain("hovered");
  });

  it("update-runtime clears activeStates via scene.command", () => {
    const { api, bus } = setup();
    api.command({
      type: "update-runtime",
      nodeId: "a",
      runtime: { activeStates: ["hovered"] },
    });
    api.command({
      type: "update-runtime",
      nodeId: "a",
      runtime: { activeStates: [] },
    });
    const rt = bus.getScene().nodes.a?.runtime as Record<string, unknown>;
    expect(rt.activeStates).not.toContain("hovered");
  });

  it("runtime activeStates contains expected states after update-runtime", () => {
    const { api, bus } = setup();
    api.command({
      type: "update-runtime",
      nodeId: "a",
      runtime: { activeStates: ["active"] },
    });
    const rt = bus.getScene().nodes.a?.runtime as Record<string, unknown>;
    const activeStates = (
      Array.isArray(rt?.activeStates) ? rt.activeStates : []
    ) as string[];
    expect(activeStates).toContain("active");
  });

  it("command returns CommandResult, not void", () => {
    const { api } = setup();
    const result = api.command({
      type: "update-runtime",
      nodeId: "a",
      runtime: { activeStates: ["hovered"] },
    });
    expect(result).toHaveProperty("ok");
    expect(result.ok).toBe(true);
  });

  it("command returns error for missing node via update-runtime", () => {
    const { api } = setup();
    const result = api.command({
      type: "update-runtime",
      nodeId: "missing",
      runtime: { activeStates: ["hovered"] },
    });
    expect(result.ok).toBe(false);
  });

  // HistoryService
  it("history.undo/redo return CommandResult", () => {
    const { api } = setup();
    expect(api.history.undo()).toHaveProperty("ok");
    expect(api.history.redo()).toHaveProperty("ok");
  });

  it("history.undo returns ok:false when empty", () => {
    const { api } = setup();
    expect(api.history.undo().ok).toBe(false);
  });

  it("history.canUndo/canRedo return booleans", () => {
    const { api } = setup();
    expect(typeof api.history.canUndo()).toBe("boolean");
    expect(typeof api.history.canRedo()).toBe("boolean");
  });

  it("history.undo reverses a dispatched action", () => {
    const { api, bus } = setup(undefined, { withHistory: true });

    api.command({
      type: "create-node",
      node: { id: "c", type: "text" },
      parentId: "root",
    });
    expect(bus.getScene().nodes.c).toBeDefined();

    const undoResult = api.history.undo();
    expect(undoResult.ok).toBe(true);
    expect(bus.getScene().nodes.c).toBeUndefined();
  });

  it("history.undo then redo round-trips correctly", () => {
    const { api, bus } = setup(undefined, { withHistory: true });

    api.command({
      type: "create-node",
      node: { id: "c", type: "text" },
      parentId: "root",
    });
    expect(bus.getScene().nodes.c).toBeDefined();

    // Undo → node removed
    expect(api.history.undo().ok).toBe(true);
    expect(bus.getScene().nodes.c).toBeUndefined();
    expect(api.history.canRedo()).toBe(true);

    // Redo → node restored
    const redoResult = api.history.redo();
    expect(redoResult.ok).toBe(true);
    expect(bus.getScene().nodes.c).toBeDefined();
  });

  // Edge cases
  it("selector.getNodeVisibility returns undefined for missing node", () => {
    expect(setup().api.selector.getNodeVisibility("missing")).toBeUndefined();
  });

  it("selector.getChildren returns empty array for missing node", () => {
    expect(setup().api.selector.getChildren("missing")).toEqual([]);
  });

  it("runtime activeStates returns empty array for missing node", () => {
    const { api } = setup();
    const node = api.selector.getNode("missing");
    const activeStates = (
      Array.isArray(
        (node?.runtime as Record<string, unknown> | undefined)?.activeStates,
      )
        ? (node!.runtime as Record<string, unknown>).activeStates
        : []
    ) as string[];
    expect(activeStates).toEqual([]);
  });

  // TransactionService
  it("transaction.begin/applyAction/commit flow", () => {
    const { api } = setup(undefined, { withTx: true });
    const tx = api.transaction.begin("user");
    expect(tx).toBeDefined();

    const r1 = api.transaction.applyAction(tx, {
      type: "update-props",
      nodeId: "a",
      props: { text: "tx" },
    });
    expect(r1.ok).toBe(true);

    // Verify within-transaction state before commit
    expect(
      (tx.currentState.nodes.a?.props as Record<string, unknown>)?.text,
    ).toBe("tx");

    const result = api.transaction.commit(tx);
    expect(result.ok).toBe(true);
  });

  it("transaction.rollback restores pre-state", () => {
    const { api } = setup(undefined, { withTx: true });
    const tx = api.transaction.begin("user");
    const textBefore = (
      tx.currentState.nodes.a?.props as Record<string, unknown>
    )?.text;

    api.transaction.applyAction(tx, {
      type: "update-props",
      nodeId: "a",
      props: { text: "changed" },
    });
    expect(
      (tx.currentState.nodes.a?.props as Record<string, unknown>)?.text,
    ).toBe("changed");

    api.transaction.rollback(tx);

    // After rollback, the original scene is unchanged
    expect((tx.preState.nodes.a?.props as Record<string, unknown>)?.text).toBe(
      textBefore,
    );
  });

  // setExclusive — now using batch-actions with update-runtime
  it("batch-actions clears previous group holder", () => {
    const { api, bus } = setup();
    // First activate state on "a"
    api.command({
      type: "update-runtime",
      nodeId: "a",
      runtime: { activeStates: ["active"] },
    });
    // Then batch to clear "a" and set "b"
    api.command({
      type: "batch-actions",
      actions: [
        {
          type: "update-runtime",
          nodeId: "a",
          runtime: { activeStates: [] },
        },
        {
          type: "update-runtime",
          nodeId: "b",
          runtime: { activeStates: ["active"] },
        },
      ],
    });

    const rtA = bus.getScene().nodes.a?.runtime as Record<string, unknown>;
    const rtB = bus.getScene().nodes.b?.runtime as Record<string, unknown>;
    expect(rtA.activeStates).not.toContain("active");
    expect(rtB.activeStates).toContain("active");
  });

  it("batch-actions falls back to full sync for structural changes", () => {
    const scene = makeScene({
      root: { id: "root", type: "container", children: ["a", "b"] },
      a: { id: "a", type: "container", parentId: "root", children: ["a1"] },
      a1: { id: "a1", type: "text", parentId: "a" },
      b: { id: "b", type: "container", parentId: "root", children: [] },
    });
    const { api } = setup(scene);

    expect(api.selector.isDescendantOf("a1", "a")).toBe(true);

    const result = api.command({
      type: "batch-actions",
      actions: [
        {
          type: "move-node",
          nodeId: "a1",
          parentId: "root",
          index: 1,
        },
      ],
    });

    expect(result.ok).toBe(true);
    expect(api.selector.isDescendantOf("a1", "a")).toBe(false);
    expect(api.selector.getDescendants("a")).toEqual([]);
  });

  // EventBus unsubscribe
  it("events.on('scene') stops after unsubscribe", async () => {
    const { api } = setup();
    let count = 0;
    const unsub = api.events.on("scene", () => {
      count++;
    });
    unsub();
    api.command({
      type: "update-props",
      nodeId: "a",
      props: { x: 1 },
    });
    await new Promise((r) => setTimeout(r, 0));
    expect(count).toBe(0);
  });
});
