import { describe, expect, it } from "vitest";
import { ActionRegistry } from "../src/engine/action-registry.js";
import type { HistoryState } from "../src/engine/history.js";
import { createUndoHistoryMiddleware } from "../src/engine/history-middleware.js";
import type { RuntimeAction } from "../src/runtime/actions.js";
import type { RuntimeContext } from "../src/runtime/handler-registry.js";
import { createNodeEntry } from "../src/runtime/handlers/create-node.js";
import type { SceneGraph } from "../src/types.js";

type RuntimeHistoryState = HistoryState<RuntimeAction>;

import { createRuntimeCommandBus } from "../src/runtime/runtime-command-bus.js";
import { baseNode, emptyScene } from "./helpers.js";

describe("createUndoHistoryMiddleware", () => {
  it("pushes an undo entry after a successful action", () => {
    let history: RuntimeHistoryState = { undoStack: [], redoStack: [] };
    const setHistory = (state: RuntimeHistoryState) => {
      history = state;
    };
    const getHistory = () => history;
    const getActorId = () => "test-actor";

    const registry = new ActionRegistry<
      RuntimeAction,
      SceneGraph,
      RuntimeContext
    >();
    registry.register("create-node", {
      handler: createNodeEntry.handler,
      inverse: createNodeEntry.inverse,
      meta: { undoable: true, mergeable: false, devtoolsLabel: "" },
    });

    const context: RuntimeContext = { now: () => 12345 };
    const middleware = createUndoHistoryMiddleware(
      getHistory,
      setHistory,
      getActorId,
      registry,
      () => context,
    );
    const bus = createRuntimeCommandBus(
      registry,
      [middleware],
      emptyScene,
      context,
    );

    const action: RuntimeAction = {
      type: "create-node",
      node: baseNode("child-1"),
      parentId: "root",
    };

    bus.dispatch(action);

    expect(history.undoStack).toHaveLength(1);
    expect(history.undoStack[0]?.action).toBe(action);
    expect(history.undoStack[0]?.actorId).toBe("test-actor");
    expect(history.undoStack[0]?.timestamp).toBe(12345);
    expect(history.redoStack).toEqual([]);
  });

  it("does not push an undo entry when action fails", () => {
    let history: RuntimeHistoryState = { undoStack: [], redoStack: [] };
    const setHistory = (state: RuntimeHistoryState) => {
      history = state;
    };
    const getHistory = () => history;
    const getActorId = () => "test-actor";

    const registry = new ActionRegistry<
      RuntimeAction,
      SceneGraph,
      RuntimeContext
    >();
    registry.register("create-node", {
      handler: () => {
        throw new Error("fail");
      },
      inverse: createNodeEntry.inverse,
      meta: { undoable: true, mergeable: false, devtoolsLabel: "" },
    });

    const context: RuntimeContext = { now: () => 12345 };
    const middleware = createUndoHistoryMiddleware(
      getHistory,
      setHistory,
      getActorId,
      registry,
      () => context,
    );
    const bus = createRuntimeCommandBus(
      registry,
      [middleware],
      emptyScene,
      context,
    );

    const action: RuntimeAction = {
      type: "create-node",
      node: baseNode("child-1"),
      parentId: "root",
    };

    bus.dispatch(action);

    expect(history.undoStack).toHaveLength(0);
  });

  it("does not push an undo entry when inverse computer returns undefined", () => {
    let history: RuntimeHistoryState = { undoStack: [], redoStack: [] };
    const setHistory = (state: RuntimeHistoryState) => {
      history = state;
    };
    const getHistory = () => history;
    const getActorId = () => "test-actor";

    const registry = new ActionRegistry<
      RuntimeAction,
      SceneGraph,
      RuntimeContext
    >();
    registry.register("create-node", {
      handler: createNodeEntry.handler,
      inverse: () => undefined,
      meta: { undoable: true, mergeable: false, devtoolsLabel: "" },
    });

    const context: RuntimeContext = { now: () => 12345 };
    const middleware = createUndoHistoryMiddleware(
      getHistory,
      setHistory,
      getActorId,
      registry,
      () => context,
    );
    const bus = createRuntimeCommandBus(
      registry,
      [middleware],
      emptyScene,
      context,
    );

    const action: RuntimeAction = {
      type: "create-node",
      node: baseNode("child-1"),
      parentId: "root",
    };

    bus.dispatch(action);

    expect(history.undoStack).toHaveLength(0);
  });
});
