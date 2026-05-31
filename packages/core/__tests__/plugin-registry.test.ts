import { describe, expect, it } from "vitest";
import {
  ComponentPluginRegistry,
  createPluginRegistry,
} from "../src/plugin-registry.js";
import type { ComponentPlugin } from "../src/plugin-types.js";

function makePlugin(
  type: string,
  overrides?: Partial<ComponentPlugin>,
): ComponentPlugin {
  return {
    type,
    renderer: () => null,
    meta: {
      title: type,
      description: `${type} component`,
      props: [],
      ...overrides?.meta,
    },
    ...overrides,
  };
}

describe("ComponentPluginRegistry", () => {
  it("registers and retrieves a plugin", () => {
    const registry = new ComponentPluginRegistry();
    const plugin = makePlugin("chart");
    registry.register(plugin);

    expect(registry.get("chart")).toBe(plugin);
  });

  it("returns undefined for unregistered plugin", () => {
    const registry = new ComponentPluginRegistry();
    expect(registry.get("missing")).toBeUndefined();
  });

  it("lists all registered plugins", () => {
    const registry = new ComponentPluginRegistry();
    const chart = makePlugin("chart");
    const table = makePlugin("table");
    registry.register(chart);
    registry.register(table);

    const list = registry.list();
    expect(list).toHaveLength(2);
    expect(list.map((p) => p.type).sort()).toEqual(["chart", "table"]);
  });

  it("returns all registered type keys", () => {
    const registry = new ComponentPluginRegistry();
    registry.register(makePlugin("chart"));
    registry.register(makePlugin("table"));

    expect(registry.getTypes().sort()).toEqual(["chart", "table"]);
  });

  it("rejects duplicate registration", () => {
    const registry = new ComponentPluginRegistry();
    registry.register(makePlugin("chart"));

    expect(() => registry.register(makePlugin("chart"))).toThrow(
      /already registered/,
    );
  });

  it("reports has correctly", () => {
    const registry = new ComponentPluginRegistry();
    registry.register(makePlugin("chart"));

    expect(registry.has("chart")).toBe(true);
    expect(registry.has("missing")).toBe(false);
  });

  it("reports size correctly", () => {
    const registry = new ComponentPluginRegistry();
    expect(registry.size).toBe(0);

    registry.register(makePlugin("chart"));
    expect(registry.size).toBe(1);

    registry.register(makePlugin("table"));
    expect(registry.size).toBe(2);
  });

  it("createPluginRegistry builds registry from array", () => {
    const registry = createPluginRegistry([
      makePlugin("chart"),
      makePlugin("table"),
    ]);

    expect(registry.size).toBe(2);
    expect(registry.has("chart")).toBe(true);
    expect(registry.has("table")).toBe(true);
  });

  it("createPluginRegistry rejects duplicates in array", () => {
    expect(() =>
      createPluginRegistry([makePlugin("chart"), makePlugin("chart")]),
    ).toThrow(/already registered/);
  });
});
