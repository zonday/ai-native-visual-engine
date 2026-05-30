import { describe, expect, it } from "vitest";
import { createHistoryState } from "../src/engine/history.js";
import { createEngineFacade } from "../src/engine-api.js";
import type { RuntimeAction } from "../src/runtime/register-handlers.js";

const createRuntimeHistoryState = createHistoryState<RuntimeAction>;

import type { Middleware } from "../src/engine/command-bus.js";
import type { RuntimeContext } from "../src/engine/handler.js";
import { createUndoHistoryMiddleware } from "../src/engine/history-middleware.js";
import { createRuntimeRegistry } from "../src/runtime/register-handlers.js";
import { createRuntimeCommandBus } from "../src/runtime/runtime-command-bus.js";
import type { PageId, SceneGraph } from "../src/types.js";
import { makeScene } from "./helpers.js";

describe("createEngineFacade", () => {
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
    const api = createEngineFacade(
      () => bus.getScene(),
      () => "page-1" as PageId,
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
  it("query.node.get returns existing node", () => {
    expect(setup().api.query.node.get("a")?.type).toBe("text");
  });

  it("query.node.get returns undefined for missing node", () => {
    expect(setup().api.query.node.get("missing")).toBeUndefined();
  });

  it("query.node.getParent returns parent", () => {
    expect(setup().api.query.node.getParent("a")?.id).toBe("root");
  });

  it("query.node.getChildren returns children array", () => {
    expect(
      setup()
        .api.query.node.getChildren("root")
        .map((n) => n.id),
    ).toEqual(["a", "b"]);
  });

  it("query.node.getChildren returns empty for leaf", () => {
    expect(setup().api.query.node.getChildren("a")).toEqual([]);
  });

  it("query.node.getProps returns props or empty object", () => {
    expect(setup().api.query.node.getProps("a")).toEqual({ text: "hello" });
    expect(setup().api.query.node.getProps("root")).toEqual({});
  });

  it("query.node.getLayout returns layout", () => {
    expect(setup().api.query.node.getLayout("a")).toBeDefined();
  });

  it("query.node.getBindings returns bindings or empty array", () => {
    expect(setup().api.query.node.getBindings("a")).toHaveLength(1);
    expect(setup().api.query.node.getBindings("root")).toEqual([]);
  });

  it("query.node.getStyle returns style or empty object", () => {
    expect(setup().api.query.node.getStyle("a")).toEqual({ color: "red" });
    expect(setup().api.query.node.getStyle("root")).toEqual({});
  });

  it("query.node.isVisible returns false for hidden node", () => {
    expect(setup().api.query.node.isVisible("b")).toBe(false);
  });

  it("query.node.isLocked returns true for locked node", () => {
    expect(setup().api.query.node.isLocked("b")).toBe(true);
  });

  it("query.node.exists checks node presence", () => {
    expect(setup().api.query.node.exists("root")).toBe(true);
    expect(setup().api.query.node.exists("missing")).toBe(false);
  });

  // SceneQuery
  it("query.scene returns root, page, version, all nodes", () => {
    const { api } = setup();
    expect(api.query.scene.getRoot().id).toBe("root");
    expect(api.query.scene.getActivePageId()).toBe("page-1");
    expect(api.query.scene.getSceneVersion()).toBe(0);
    expect(api.query.scene.getAllNodes()).toHaveLength(3);
  });

  it("query.scene.findNodes and findNodeByType filter correctly", () => {
    const { api } = setup();
    expect(api.query.scene.findNodes((n) => n.type === "text")).toHaveLength(2);
    expect(api.query.scene.findNodeByType("text")).toHaveLength(2);
  });

  // SelectionQuery (read-only)
  it("query.selection reads current selection", () => {
    const { api } = setup();
    expect(api.query.selection.getSelection()).toEqual([]);
    expect(api.query.selection.isSelected("a")).toBe(false);
  });

  // CommandService
  it("command.dispatch creates node", () => {
    const { api, bus } = setup();
    const result = api.command.dispatch({
      type: "create-node",
      node: { id: "c", type: "text" },
      parentId: "root",
    });
    expect(result.ok).toBe(true);
    expect(bus.getScene().nodes.c).toBeDefined();
  });

  it("command.dispatch removes node", () => {
    const { api, bus } = setup();
    const result = api.command.dispatch({ type: "remove-node", nodeId: "a" });
    expect(result.ok).toBe(true);
    expect(bus.getScene().nodes.a).toBeUndefined();
  });

  it("command.dispatch rejects create-node with invalid parent", () => {
    const result = setup().api.command.dispatch({
      type: "create-node",
      node: { id: "x", type: "text" },
      parentId: "missing",
    });
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("scene.invalid-parent");
  });

  it("command.dispatch rejects remove-node on locked node", () => {
    const result = setup().api.command.dispatch({
      type: "remove-node",
      nodeId: "b",
    });
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("scene.locked");
  });

  it("command.dispatch rejects with missing node for update actions", () => {
    const { api } = setup();
    expect(
      api.command.dispatch({
        type: "move-node",
        nodeId: "missing",
        parentId: "root",
      }).ok,
    ).toBe(false);
    expect(
      api.command.dispatch({
        type: "update-layout",
        nodeId: "missing",
        layout: {},
      }).ok,
    ).toBe(false);
  });

  it("command.dispatch move-node, update-layout, update-props work", () => {
    const { api } = setup();
    expect(
      api.command.dispatch({
        type: "move-node",
        nodeId: "a",
        parentId: "root",
        index: 0,
      }).ok,
    ).toBe(true);
    expect(
      api.command.dispatch({
        type: "update-layout",
        nodeId: "a",
        layout: { x: 100 },
      }).ok,
    ).toBe(true);
    expect(
      api.command.dispatch({
        type: "update-props",
        nodeId: "a",
        props: { text: "updated" },
      }).ok,
    ).toBe(true);
  });

  it("command.dispatch update-style, update-bindings, update-runtime, rotate-node work", () => {
    const { api } = setup();
    expect(
      api.command.dispatch({
        type: "update-style",
        nodeId: "a",
        style: { color: "blue" },
      }).ok,
    ).toBe(true);
    expect(
      api.command.dispatch({
        type: "update-bindings",
        nodeId: "a",
        bindings: [],
      }).ok,
    ).toBe(true);
    expect(
      api.command.dispatch({
        type: "update-runtime",
        nodeId: "a",
        runtime: { loading: true },
      }).ok,
    ).toBe(true);
    expect(
      api.command.dispatch({ type: "rotate-node", nodeId: "a", rotation: 45 })
        .ok,
    ).toBe(true);
  });

  // selection mutation through command.dispatch
  it("command.dispatch updates selection", () => {
    const { api, bus } = setup();
    const result = api.command.dispatch({
      type: "update-selection",
      nodeIds: ["a", "b"],
    });
    expect(result.ok).toBe(true);
    expect(bus.getScene().selection?.nodeIds).toEqual(["a", "b"]);
  });

  // EventBus
  it("events.subscribeToScene fires on dispatch", async () => {
    const { api } = setup();
    let fired = false;
    api.events.subscribeToScene(() => {
      fired = true;
    });
    api.command.dispatch({
      type: "update-props",
      nodeId: "a",
      props: { x: 1 },
    });
    await new Promise((r) => setTimeout(r, 0));
    expect(fired).toBe(true);
  });

  it("events.subscribeToSelection fires on selection change", async () => {
    const { api } = setup();
    let fired = false;
    api.events.subscribeToSelection(() => {
      fired = true;
    });
    api.command.dispatch({
      type: "update-selection",
      nodeIds: ["a"],
    });
    await new Promise((r) => setTimeout(r, 0));
    expect(fired).toBe(true);
  });

  it("subscribe returns unsubscribe function", () => {
    const { api } = setup();
    const unsub = api.events.subscribeToScene(() => {});
    expect(typeof unsub).toBe("function");
    unsub();
  });

  // StateService
  it("states.setState activates state via command bus", () => {
    const { api, bus } = setup();
    const result = api.states.setState("a", "hovered");
    expect(result.ok).toBe(true);
    const rt = bus.getScene().nodes.a?.runtime as Record<string, unknown>;
    expect(rt.activeStates).toContain("hovered");
  });

  it("states.clearState deactivates a state", () => {
    const { api, bus } = setup();
    api.states.setState("a", "hovered");
    api.states.clearState("a", "hovered");
    const rt = bus.getScene().nodes.a?.runtime as Record<string, unknown>;
    expect(rt.activeStates).not.toContain("hovered");
  });

  it("states.getActiveStates returns active states", () => {
    const { api } = setup();
    api.states.setState("a", "active");
    expect(api.states.getActiveStates("a")).toContain("active");
  });

  it("states.setState returns CommandResult, not void", () => {
    const { api } = setup();
    const result = api.states.setState("a", "hovered");
    expect(result).toHaveProperty("ok");
    expect(result.ok).toBe(true);
  });

  it("states.setState returns error for missing node", () => {
    const { api } = setup();
    const result = api.states.setState("missing", "hovered");
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

    api.command.dispatch({
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

    api.command.dispatch({
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
  it("query.node.isVisible returns false for missing node", () => {
    expect(setup().api.query.node.isVisible("missing")).toBe(false);
  });

  it("query.node.getChildren returns empty array for missing node", () => {
    expect(setup().api.query.node.getChildren("missing")).toEqual([]);
  });

  it("states.getActiveStates returns empty array for missing node", () => {
    expect(setup().api.states.getActiveStates("missing")).toEqual([]);
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

  // StateService — setExclusive O(1)
  it("states.setExclusive clears previous holder via group index", () => {
    const { api, bus } = setup();
    api.states.setExclusive("a", "active", "group1");
    api.states.setExclusive("b", "active", "group1");

    const rtA = bus.getScene().nodes.a?.runtime as Record<string, unknown>;
    const rtB = bus.getScene().nodes.b?.runtime as Record<string, unknown>;
    expect(rtA.activeStates).not.toContain("active");
    expect(rtB.activeStates).toContain("active");
  });

  // EventBus unsubscribe
  it("events.subscribeToScene stops after unsubscribe", async () => {
    const { api } = setup();
    let count = 0;
    const unsub = api.events.subscribeToScene(() => {
      count++;
    });
    unsub();
    api.command.dispatch({
      type: "update-props",
      nodeId: "a",
      props: { x: 1 },
    });
    await new Promise((r) => setTimeout(r, 0));
    expect(count).toBe(0);
  });
});
