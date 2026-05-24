import { describe, it, expect } from "vitest";
import type { PersistedSceneGraph } from "../src/types.js";
import type { RuntimeAction } from "../src/runtime/actions.js";
import {
  createRuntimeEventLog,
  appendRuntimeEvent,
} from "../src/runtime/event-log.js";

const emptyPersistedScene: PersistedSceneGraph = {
  version: 0,
  rootId: "root",
  nodes: { root: { id: "root", type: "container" } },
};

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
