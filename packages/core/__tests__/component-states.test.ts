import { describe, it, expect } from "vitest";
import { resolveStateProps } from "../src/component-states.js";
import type { ComponentStatesConfig } from "../src/component-states.js";
import type { SceneNode } from "../src/types.js";

const tabConfig: ComponentStatesConfig = {
  states: [
    { name: "default", props: { color: "gray", weight: "normal" } },
    { name: "hovered", props: { color: "lightblue" } },
    { name: "selected", props: { color: "blue", weight: "bold" }, persisted: true },
    { name: "disabled", props: { color: "lightgray", interactive: false } },
  ],
};

describe("resolveStateProps", () => {
  it("returns empty object when no active states", () => {
    const node: SceneNode = { id: "n1", type: "tab" };
    expect(resolveStateProps(node, tabConfig)).toEqual({});
  });

  it("resolves a single active state", () => {
    const node: SceneNode = { id: "n1", type: "tab", activeStates: ["selected"] };
    expect(resolveStateProps(node, tabConfig)).toEqual({
      color: "blue",
      weight: "bold",
    });
  });

  it("merges multiple active states in activation order", () => {
    const node: SceneNode = {
      id: "n1",
      type: "tab",
      activeStates: ["default", "hovered", "selected"],
    };
    const result = resolveStateProps(node, tabConfig);
    expect(result.color).toBe("blue");
    expect(result.weight).toBe("bold");
  });

  it("later state overrides earlier on conflict", () => {
    const node: SceneNode = {
      id: "n1",
      type: "tab",
      activeStates: ["default", "selected"],
    };
    const result = resolveStateProps(node, tabConfig);
    expect(result.color).toBe("blue");
    expect(result.weight).toBe("bold");
  });

  it("ignores unknown state names", () => {
    const node: SceneNode = {
      id: "n1",
      type: "tab",
      activeStates: ["unknown", "default"],
    };
    expect(resolveStateProps(node, tabConfig)).toEqual({
      color: "gray",
      weight: "normal",
    });
  });

  it("returns empty when activeStates is empty array", () => {
    const node: SceneNode = { id: "n1", type: "tab", activeStates: [] };
    expect(resolveStateProps(node, tabConfig)).toEqual({});
  });
});
