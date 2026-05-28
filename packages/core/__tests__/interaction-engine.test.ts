import { describe, expect, it, vi } from "vitest";
import { createInteractionEngine } from "../src/interaction/interaction-engine.js";

describe("InteractionEngine", () => {
  describe("selection state", () => {
    it("starts with empty selection", () => {
      const eng = createInteractionEngine();
      expect(eng.getSelection()).toEqual([]);
    });

    it("select replaces current selection", () => {
      const eng = createInteractionEngine();
      eng.select(["a", "b"]);
      expect(eng.getSelection()).toEqual(["a", "b"]);
    });

    it("select overrides previous selection", () => {
      const eng = createInteractionEngine();
      eng.select(["a"]);
      eng.select(["b"]);
      expect(eng.getSelection()).toEqual(["b"]);
    });

    it("isSelected returns true for selected node", () => {
      const eng = createInteractionEngine();
      eng.select(["a"]);
      expect(eng.isSelected("a")).toBe(true);
    });

    it("isSelected returns false for non-selected node", () => {
      const eng = createInteractionEngine();
      eng.select(["a"]);
      expect(eng.isSelected("b")).toBe(false);
    });

    it("isSelected returns false when selection is empty", () => {
      const eng = createInteractionEngine();
      expect(eng.isSelected("a")).toBe(false);
    });

    it("addToSelection appends to existing selection without duplicates", () => {
      const eng = createInteractionEngine();
      eng.select(["a"]);
      eng.addToSelection(["b", "a"]);
      expect(eng.getSelection()).toEqual(["a", "b"]);
    });

    it("removeFromSelection removes specific nodes", () => {
      const eng = createInteractionEngine();
      eng.select(["a", "b", "c"]);
      eng.removeFromSelection(["b"]);
      expect(eng.getSelection()).toEqual(["a", "c"]);
    });

    it("removeFromSelection is no-op for unselected nodes", () => {
      const eng = createInteractionEngine();
      eng.select(["a"]);
      eng.removeFromSelection(["b"]);
      expect(eng.getSelection()).toEqual(["a"]);
    });

    it("clearSelection empties selection", () => {
      const eng = createInteractionEngine();
      eng.select(["a", "b"]);
      eng.clearSelection();
      expect(eng.getSelection()).toEqual([]);
    });

    it("clearSelection is no-op when already empty", () => {
      const eng = createInteractionEngine();
      eng.clearSelection();
      expect(eng.getSelection()).toEqual([]);
    });

    it("toggleSelection adds node not in selection", () => {
      const eng = createInteractionEngine();
      eng.select(["a"]);
      eng.toggleSelection("b");
      expect(eng.getSelection()).toContain("b");
      expect(eng.getSelection()).toHaveLength(2);
    });

    it("toggleSelection removes node already in selection", () => {
      const eng = createInteractionEngine();
      eng.select(["a", "b"]);
      eng.toggleSelection("a");
      expect(eng.getSelection()).not.toContain("a");
      expect(eng.getSelection()).toEqual(["b"]);
    });

    it("toggleSelection works on empty selection", () => {
      const eng = createInteractionEngine();
      eng.toggleSelection("a");
      expect(eng.getSelection()).toEqual(["a"]);
    });

    it("getSelection returns a copy, not internal reference", () => {
      const eng = createInteractionEngine();
      eng.select(["a"]);
      const selection = eng.getSelection();
      selection.push("b");
      expect(eng.getSelection()).toEqual(["a"]);
    });
  });

  describe("notifications", () => {
    it("notifies on select", () => {
      const eng = createInteractionEngine();
      const listener = vi.fn();
      eng.subscribe(listener);
      eng.select(["a"]);
      expect(listener).toHaveBeenCalledWith({
        type: "selection-changed",
        nodeIds: ["a"],
      });
    });

    it("notifies on addToSelection", () => {
      const eng = createInteractionEngine();
      eng.select(["a"]);
      const listener = vi.fn();
      eng.subscribe(listener);
      eng.addToSelection(["b"]);
      expect(listener).toHaveBeenCalledWith({
        type: "selection-changed",
        nodeIds: ["a", "b"],
      });
    });

    it("notifies on removeFromSelection", () => {
      const eng = createInteractionEngine();
      eng.select(["a", "b"]);
      const listener = vi.fn();
      eng.subscribe(listener);
      eng.removeFromSelection(["a"]);
      expect(listener).toHaveBeenCalledWith({
        type: "selection-changed",
        nodeIds: ["b"],
      });
    });

    it("notifies on clearSelection", () => {
      const eng = createInteractionEngine();
      eng.select(["a"]);
      const listener = vi.fn();
      eng.subscribe(listener);
      eng.clearSelection();
      expect(listener).toHaveBeenCalledWith({
        type: "selection-changed",
        nodeIds: [],
      });
    });

    it("does not notify on clearSelection when already empty", () => {
      const eng = createInteractionEngine();
      const listener = vi.fn();
      eng.subscribe(listener);
      eng.clearSelection();
      expect(listener).not.toHaveBeenCalled();
    });

    it("notifies once on toggleSelection (add branch)", () => {
      const eng = createInteractionEngine();
      const listener = vi.fn();
      eng.subscribe(listener);
      eng.toggleSelection("a");
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith({
        type: "selection-changed",
        nodeIds: ["a"],
      });
    });

    it("notifies once on toggleSelection (remove branch)", () => {
      const eng = createInteractionEngine();
      eng.select(["a"]);
      const listener = vi.fn();
      eng.subscribe(listener);
      eng.toggleSelection("a");
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith({
        type: "selection-changed",
        nodeIds: [],
      });
    });

    it("notifies on setHoveredNode", () => {
      const eng = createInteractionEngine();
      const listener = vi.fn();
      eng.subscribe(listener);
      eng.setHoveredNode("a");
      expect(listener).toHaveBeenCalledWith({
        type: "hover-changed",
        nodeId: "a",
      });
    });

    it("notifies on hover clear", () => {
      const eng = createInteractionEngine();
      eng.setHoveredNode("a");
      const listener = vi.fn();
      eng.subscribe(listener);
      eng.setHoveredNode(undefined);
      expect(listener).toHaveBeenCalledWith({
        type: "hover-changed",
        nodeId: undefined,
      });
    });

    it("isolates listener errors", () => {
      const eng = createInteractionEngine();
      eng.subscribe(() => {
        throw new Error("bad listener");
      });
      const goodListener = vi.fn();
      eng.subscribe(goodListener);
      expect(() => eng.select(["a"])).not.toThrow();
      expect(goodListener).toHaveBeenCalledTimes(1);
    });

    it("unsubscribe stops notifications", () => {
      const eng = createInteractionEngine();
      const listener = vi.fn();
      const unsub = eng.subscribe(listener);
      unsub();
      eng.select(["a"]);
      expect(listener).not.toHaveBeenCalled();
    });

    it("supports multiple listeners", () => {
      const eng = createInteractionEngine();
      const l1 = vi.fn();
      const l2 = vi.fn();
      eng.subscribe(l1);
      eng.subscribe(l2);
      eng.select(["a"]);
      expect(l1).toHaveBeenCalledTimes(1);
      expect(l2).toHaveBeenCalledTimes(1);
    });
  });

  describe("hover state", () => {
    it("starts with no hovered node", () => {
      const eng = createInteractionEngine();
      expect(eng.getHoveredNode()).toBeUndefined();
    });

    it("setHoveredNode updates hover state", () => {
      const eng = createInteractionEngine();
      eng.setHoveredNode("a");
      expect(eng.getHoveredNode()).toBe("a");
    });

    it("setHoveredNode(undefined) clears hover", () => {
      const eng = createInteractionEngine();
      eng.setHoveredNode("a");
      eng.setHoveredNode(undefined);
      expect(eng.getHoveredNode()).toBeUndefined();
    });
  });

  describe("lifecycle", () => {
    it("reset clears selection", () => {
      const eng = createInteractionEngine();
      eng.select(["a", "b"]);
      eng.reset();
      expect(eng.getSelection()).toEqual([]);
    });

    it("reset clears hover", () => {
      const eng = createInteractionEngine();
      eng.setHoveredNode("a");
      eng.reset();
      expect(eng.getHoveredNode()).toBeUndefined();
    });

    it("reset does not remove listeners", () => {
      const eng = createInteractionEngine();
      const listener = vi.fn();
      eng.subscribe(listener);
      eng.reset();
      eng.select(["a"]);
      expect(listener).toHaveBeenCalledTimes(1);
    });
  });
});
