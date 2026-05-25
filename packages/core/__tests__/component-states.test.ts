import { describe, it, expect } from "vitest";
import { resolveStateProps } from "../src/component-states.js";
import type { ComponentStateDef } from "../src/component-states.js";

const states: ComponentStateDef[] = [
  { name: "default", props: { color: "gray", weight: "normal" } },
  { name: "hovered", props: { color: "lightblue" } },
  { name: "selected", props: { color: "blue", weight: "bold" }, persisted: true },
  { name: "disabled", props: { color: "lightgray", interactive: false } },
];

function stateMap(s: ComponentStateDef[]) {
  const m = new Map<string, Record<string, unknown>>();
  for (const st of s) m.set(st.name, st.props);
  return m;
}

describe("resolveStateProps", () => {
  it("returns empty object when no active states", () => {
    const m = stateMap(states);
    expect(resolveStateProps([], m)).toEqual({});
  });

  it("resolves a single active state", () => {
    const m = stateMap(states);
    expect(resolveStateProps(["selected"], m)).toEqual({
      color: "blue",
      weight: "bold",
    });
  });

  it("merges multiple active states in activation order", () => {
    const m = stateMap(states);
    const result = resolveStateProps(["default", "hovered", "selected"], m);
    expect(result.color).toBe("blue");
    expect(result.weight).toBe("bold");
  });

  it("later state overrides earlier on conflict", () => {
    const m = stateMap(states);
    const result = resolveStateProps(["default", "selected"], m);
    expect(result.color).toBe("blue");
    expect(result.weight).toBe("bold");
  });

  it("ignores unknown state names", () => {
    const m = stateMap(states);
    expect(resolveStateProps(["unknown", "default"], m)).toEqual({
      color: "gray",
      weight: "normal",
    });
  });

  it("returns empty when activeStates is empty array", () => {
    const m = stateMap(states);
    expect(resolveStateProps([], m)).toEqual({});
  });
});
