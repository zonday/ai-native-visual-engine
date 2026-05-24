import { describe, it, expect } from "vitest";
import type { RuntimeAction } from "../src/runtime/actions.js";
import {
  createRuntimeHistoryState,
  pushRuntimeUndo,
  undoRuntimeAction,
  redoRuntimeAction,
  DEFAULT_MAX_RUNTIME_UNDO_STACK,
} from "../src/runtime/history.js";

const createAction: RuntimeAction = {
  type: "create-node",
  node: { id: "child-1", type: "container" },
  parentId: "root",
};

const removeAction: RuntimeAction = {
  type: "remove-node",
  nodeId: "child-1",
};

describe("createRuntimeHistoryState", () => {
  it("returns an empty undo and redo stack", () => {
    const state = createRuntimeHistoryState();
    expect(state.undoStack).toEqual([]);
    expect(state.redoStack).toEqual([]);
  });
});

describe("pushRuntimeUndo", () => {
  it("appends an entry to the undo stack and clears the redo stack", () => {
    const state = createRuntimeHistoryState();
    const entry = { action: createAction, inverseAction: removeAction, timestamp: Date.now() };
    const newState = pushRuntimeUndo(state, entry);
    expect(newState.undoStack).toHaveLength(1);
    expect(newState.undoStack[0]).toBe(entry);
    expect(newState.redoStack).toEqual([]);
  });

  it("trims the undo stack when it exceeds max size", () => {
    let state = createRuntimeHistoryState();
    for (let i = 0; i < DEFAULT_MAX_RUNTIME_UNDO_STACK + 10; i++) {
      const entry = { action: createAction, inverseAction: removeAction, timestamp: i };
      state = pushRuntimeUndo(state, entry);
    }
    expect(state.undoStack).toHaveLength(DEFAULT_MAX_RUNTIME_UNDO_STACK);
    expect(state.undoStack[0]?.timestamp).toBe(10);
  });

  it("respects a custom max stack size", () => {
    let state = createRuntimeHistoryState();
    const max = 3;
    for (let i = 0; i < 5; i++) {
      const entry = { action: createAction, inverseAction: removeAction, timestamp: i };
      state = pushRuntimeUndo(state, entry, max);
    }
    expect(state.undoStack).toHaveLength(max);
    expect(state.undoStack[0]?.timestamp).toBe(2);
  });
});

describe("undoRuntimeAction", () => {
  it("returns null when undo stack is empty", () => {
    const state = createRuntimeHistoryState();
    const result = undoRuntimeAction(state);
    expect(result).toBeNull();
  });

  it("returns null when the top entry has no inverse action", () => {
    const state = {
      undoStack: [{ action: createAction, timestamp: Date.now() }],
      redoStack: [],
    };
    const result = undoRuntimeAction(state);
    expect(result).toBeNull();
  });

  it("pops the top entry from undo stack and pushes it to redo stack", () => {
    const entry = { action: createAction, inverseAction: removeAction, timestamp: Date.now() };
    const state = {
      undoStack: [entry],
      redoStack: [],
    };
    const result = undoRuntimeAction(state);
    expect(result).not.toBeNull();
    expect(result?.inverseAction).toBe(removeAction);
    expect(result?.state.undoStack).toEqual([]);
    expect(result?.state.redoStack).toEqual([entry]);
  });
});

describe("redoRuntimeAction", () => {
  it("returns null when redo stack is empty", () => {
    const state = createRuntimeHistoryState();
    const result = redoRuntimeAction(state);
    expect(result).toBeNull();
  });

  it("pops the top entry from redo stack and pushes it to undo stack", () => {
    const entry = { action: createAction, inverseAction: removeAction, timestamp: Date.now() };
    const state = {
      undoStack: [],
      redoStack: [entry],
    };
    const result = redoRuntimeAction(state);
    expect(result).not.toBeNull();
    expect(result?.action).toBe(createAction);
    expect(result?.state.undoStack).toEqual([entry]);
    expect(result?.state.redoStack).toEqual([]);
  });
});
