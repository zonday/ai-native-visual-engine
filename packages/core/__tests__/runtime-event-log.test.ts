import { describe, expect, it } from "vitest";
import type { RuntimeAction } from "../src/runtime/actions.js";
import {
  appendRuntimeEvent,
  createRuntimeEventLog,
  replayRuntimeEvents,
} from "../src/runtime/event-log.js";
import type { SceneGraph } from "../src/types.js";
import { baseNode, emptyPersistedScene, makeScene } from "./helpers.js";

describe("createRuntimeEventLog", () => {
  it("creates an event log with the initial scene and empty actions", () => {
    const log = createRuntimeEventLog(emptyPersistedScene);
    expect(log.initialScene).toBe(emptyPersistedScene);
    expect(log.actions).toEqual([]);
  });
});

describe("appendRuntimeEvent", () => {
  it("appends an event entry to the action log", () => {
    const log = createRuntimeEventLog(emptyPersistedScene);
    const action: RuntimeAction = {
      type: "create-node",
      node: { id: "child-1", type: "container" },
      parentId: "root",
    };
    const entry = { action, actorId: "test", timestamp: Date.now() };
    const newLog = appendRuntimeEvent(log, entry);
    expect(newLog.actions).toHaveLength(1);
    expect(newLog.actions[0]).toBe(entry);
    expect(newLog.initialScene).toBe(emptyPersistedScene);
  });

  it("does not mutate the original log", () => {
    const log = createRuntimeEventLog(emptyPersistedScene);
    const action: RuntimeAction = {
      type: "create-node",
      node: { id: "child-1", type: "container" },
      parentId: "root",
    };
    const entry = { action, actorId: "test", timestamp: Date.now() };
    appendRuntimeEvent(log, entry);
    expect(log.actions).toEqual([]);
  });
});

describe("replayRuntimeEvents", () => {
  it("replays actions from the log and updates the scene", () => {
    const log = createRuntimeEventLog(emptyPersistedScene);
    let scene = makeScene({
      root: { id: "root", type: "container", children: [] },
    });

    const dispatch = (action: RuntimeAction) => {
      const a = action as Extract<RuntimeAction, { type: "create-node" }>;
      scene = {
        ...scene,
        nodes: {
          ...scene.nodes,
          root: {
            ...scene.nodes.root,
            children: [...(scene.nodes.root?.children ?? []), a.node.id],
          },
          [a.node.id]: { ...a.node, parentId: "root" },
        },
      };
      return { ok: true, scene };
    };

    log.actions.push({
      action: { type: "create-node", node: baseNode("a"), parentId: "root" },
      timestamp: 1,
    });
    log.actions.push({
      action: { type: "create-node", node: baseNode("b"), parentId: "root" },
      timestamp: 2,
    });

    replayRuntimeEvents(log, dispatch);
    expect(scene.nodes.a).toBeDefined();
    expect(scene.nodes.b).toBeDefined();
    expect(scene.nodes.root?.children).toEqual(["a", "b"]);
  });

  it("skips update-selection actions during replay", () => {
    const log = createRuntimeEventLog(emptyPersistedScene);
    let dispatchCount = 0;
    const dispatch = (_action: RuntimeAction) => {
      dispatchCount++;
      return { ok: true, scene: emptyPersistedScene as SceneGraph };
    };

    log.actions.push({
      action: { type: "update-selection", nodeIds: ["root"] },
      timestamp: 1,
    });
    log.actions.push({
      action: { type: "create-node", node: baseNode("a"), parentId: "root" },
      timestamp: 2,
    });

    replayRuntimeEvents(log, dispatch);
    expect(dispatchCount).toBe(1);
  });

  it("throws when a dispatched action fails", () => {
    const log = createRuntimeEventLog(emptyPersistedScene);
    const dispatch = (_action: RuntimeAction) => ({
      ok: false,
      scene: emptyPersistedScene as SceneGraph,
      error: { code: "fail", message: "oops" },
    });

    log.actions.push({
      action: { type: "create-node", node: baseNode("a"), parentId: "root" },
      timestamp: 1,
    });

    expect(() => replayRuntimeEvents(log, dispatch)).toThrow("Replay failed");
  });
});
