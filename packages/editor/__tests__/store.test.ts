import { describe, it, expect } from "vitest";
import { useEditorStore } from "../src/store.js";

describe("EditorStore", () => {
  it("starts with empty selection", () => {
    const state = useEditorStore.getState();
    expect(state.nodeIds).toEqual([]);
  });

  it("setSelection replaces selection", () => {
    useEditorStore.getState().setSelection(["a", "b"]);
    expect(useEditorStore.getState().nodeIds).toEqual(["a", "b"]);
  });

  it("clearSelection empties the selection", () => {
    useEditorStore.getState().setSelection(["a"]);
    useEditorStore.getState().clearSelection();
    expect(useEditorStore.getState().nodeIds).toEqual([]);
  });

  it("addToSelection appends a new id", () => {
    useEditorStore.getState().setSelection(["a"]);
    useEditorStore.getState().addToSelection("b");
    expect(useEditorStore.getState().nodeIds).toEqual(["a", "b"]);
  });

  it("addToSelection does not duplicate existing id", () => {
    useEditorStore.getState().setSelection(["a"]);
    useEditorStore.getState().addToSelection("a");
    expect(useEditorStore.getState().nodeIds).toEqual(["a"]);
  });

  it("removeFromSelection removes an id", () => {
    useEditorStore.getState().setSelection(["a", "b"]);
    useEditorStore.getState().removeFromSelection("a");
    expect(useEditorStore.getState().nodeIds).toEqual(["b"]);
  });

  it("starts with default viewport", () => {
    const state = useEditorStore.getState();
    expect(state.viewport).toEqual({ x: 0, y: 0, zoom: 1 });
  });

  it("setViewport updates viewport", () => {
    useEditorStore.getState().setViewport({ x: 100, y: 200, zoom: 2 });
    expect(useEditorStore.getState().viewport).toEqual({
      x: 100,
      y: 200,
      zoom: 2,
    });
  });

  it("resetViewport restores default viewport", () => {
    useEditorStore.getState().setViewport({ x: 100, y: 200, zoom: 2 });
    useEditorStore.getState().resetViewport();
    expect(useEditorStore.getState().viewport).toEqual({ x: 0, y: 0, zoom: 1 });
  });

  it("starts with null activePageId", () => {
    const state = useEditorStore.getState();
    expect(state.activePageId).toBeNull();
  });

  it("setActivePage sets the active page", () => {
    useEditorStore.getState().setActivePage("page-1");
    expect(useEditorStore.getState().activePageId).toBe("page-1");
  });
});
