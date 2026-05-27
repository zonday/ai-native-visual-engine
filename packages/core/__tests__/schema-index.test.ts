import { describe, expect, it } from "vitest";
import {
  buildSchemaIndex,
  schemaIndexToSnapshot,
} from "../src/compiler/schema-index.js";
import type { ComponentPlugin } from "../src/plugin-types.js";
import { ComponentPluginRegistry } from "../src/plugins/registry.js";

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

describe("buildSchemaIndex", () => {
  it("produces empty index from empty registry", () => {
    const registry = new ComponentPluginRegistry();
    const index = buildSchemaIndex(registry);

    expect(index.components.size).toBe(0);
    expect(index.componentTypes).toEqual([]);
  });

  it("indexes a single plugin with all fields", () => {
    const registry = new ComponentPluginRegistry();
    const chart = makePlugin("chart", {
      meta: {
        title: "Chart",
        description: "Renders data as a chart",
        category: "visualization",
        props: [
          {
            key: "dataSource",
            type: "string",
            required: true,
            description: "Data source ID",
          },
          { key: "chartType", type: "string", default: "bar" },
        ],
        ai: {
          usage: ["visualize tabular data"],
          antiPatterns: ["using chart for single KPI"],
          relatedComponents: ["metric-value", "table"],
          keywords: ["graph", "plot", "visualization"],
        },
      },
      capabilities: {
        canHaveChildren: false,
        canResize: true,
      },
      constraints: [{ type: "layout", rule: "min-width: 4 columns" }],
    });
    registry.register(chart);

    const index = buildSchemaIndex(registry);
    const entry = index.components.get("chart");

    expect(entry).toBeDefined();
    expect(entry?.type).toBe("chart");
    expect(entry?.name).toBe("Chart");
    expect(entry?.description).toBe("Renders data as a chart");
    expect(entry?.category).toBe("visualization");
    expect(entry?.props).toHaveLength(2);
    expect(entry?.props[0]?.key).toBe("dataSource");
    expect(entry?.props[0]?.required).toBe(true);
    expect(entry?.props[1]?.key).toBe("chartType");
    expect(entry?.props[1]?.defaultValue).toBe("bar");
    expect(entry?.layoutCapabilities?.canResize).toBe(true);
    expect(entry?.constraints?.[0]?.type).toBe("layout");
    expect(entry?.ai?.usage).toEqual(["visualize tabular data"]);
    expect(entry?.ai?.antiPatterns).toEqual(["using chart for single KPI"]);
    expect(entry?.ai?.keywords).toEqual(["graph", "plot", "visualization"]);
  });

  it("indexes multiple plugins and returns all types", () => {
    const registry = new ComponentPluginRegistry();
    registry.register(makePlugin("chart"));
    registry.register(makePlugin("table"));
    registry.register(makePlugin("metric-value"));

    const index = buildSchemaIndex(registry);

    expect(index.components.size).toBe(3);
    expect(index.componentTypes.sort()).toEqual([
      "chart",
      "metric-value",
      "table",
    ]);
  });

  it("maps prop meta fields correctly including optional fields", () => {
    const registry = new ComponentPluginRegistry();
    registry.register(
      makePlugin("kpi", {
        meta: {
          title: "KPI",
          description: "KPI card",
          props: [
            {
              key: "value",
              type: "number",
              required: true,
              description: "Primary value",
            },
            { key: "label", type: "string", required: false, default: "N/A" },
          ],
        },
      }),
    );

    const index = buildSchemaIndex(registry);
    const kpi = index.components.get("kpi");

    expect(kpi?.props).toHaveLength(2);
    expect(kpi?.props[0]).toEqual({
      key: "value",
      type: "number",
      required: true,
      description: "Primary value",
      defaultValue: undefined,
    });
    expect(kpi?.props[1]?.defaultValue).toBe("N/A");
    expect(kpi?.props[1]?.required).toBe(false);
  });

  it("handles plugin without ai metadata", () => {
    const registry = new ComponentPluginRegistry();
    registry.register(makePlugin("divider"));

    const index = buildSchemaIndex(registry);
    const entry = index.components.get("divider");

    expect(entry?.ai).toBeUndefined();
  });

  it("handles plugin without capabilities or constraints", () => {
    const registry = new ComponentPluginRegistry();
    registry.register(makePlugin("text"));

    const index = buildSchemaIndex(registry);
    const entry = index.components.get("text");

    expect(entry?.layoutCapabilities).toBeUndefined();
    expect(entry?.constraints).toBeUndefined();
  });

  it("schemaIndexToSnapshot converts Map to Record for serialization", () => {
    const registry = new ComponentPluginRegistry();
    registry.register(
      makePlugin("chart", {
        meta: {
          title: "Chart",
          description: "Chart component",
          props: [],
        },
      }),
    );
    registry.register(
      makePlugin("table", {
        meta: {
          title: "Table",
          description: "Table component",
          props: [],
        },
      }),
    );

    const index = buildSchemaIndex(registry);
    const snapshot = schemaIndexToSnapshot(index);

    expect(Object.keys(snapshot.components).sort()).toEqual(["chart", "table"]);
    expect(snapshot.components.chart?.name).toBe("Chart");
    expect(snapshot.components.table?.name).toBe("Table");
    expect(snapshot.componentTypes.sort()).toEqual(["chart", "table"]);
  });
});
