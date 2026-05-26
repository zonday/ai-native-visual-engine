import { describe, it, expect } from "vitest";
import { recommendComponents } from "../src/component-recommender.js";
import type { AiSchemaIndexSnapshot } from "@ai-native/core";

const index: AiSchemaIndexSnapshot = {
  components: {
    "metric-value": {
      type: "metric-value",
      name: "Metric Value",
      description: "Displays a single metric value",
      props: [],
      ai: {
        keywords: ["revenue", "metric", "kpi", "number"],
        usage: ["display a single number", "show key metric"],
        antiPatterns: ["complex chart", "table"],
      },
    },
    chart: {
      type: "chart",
      name: "Chart",
      description: "Visualizes data as a chart",
      props: [],
      category: "visualization",
      ai: {
        keywords: ["chart", "trend", "bar", "line"],
        usage: ["visualize data", "show trend"],
        antiPatterns: ["text only"],
      },
    },
    table: {
      type: "table",
      name: "Table",
      description: "Displays data in tabular format",
      props: [],
      ai: {
        keywords: ["table", "tabular", "rows"],
        usage: ["display data in rows", "show list"],
      },
    },
    text: {
      type: "text",
      name: "Text",
      description: "Plain text display",
      props: [],
    },
  },
  componentTypes: ["metric-value", "chart", "table", "text"],
};

describe("recommendComponents", () => {
  it("returns chart when prompt mentions trends", () => {
    const results = recommendComponents("show me a trend chart for revenue", index);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.componentType).toBe("chart");
  });

  it("returns metric-value when prompt mentions revenue", () => {
    const results = recommendComponents("display revenue as a key metric", index);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.componentType).toBe("metric-value");
  });

  it("excludes component with anti-pattern match", () => {
    const results = recommendComponents("show complex chart and table", index);
    const hasMetricValue = results.some((r) => r.componentType === "metric-value");
    expect(hasMetricValue).toBe(false);
  });

  it("ranks by name match higher", () => {
    const results = recommendComponents("I need a table", index);
    expect(results[0]?.componentType).toBe("table");
  });

  it("returns empty for no matches", () => {
    const results = recommendComponents("nothing relevant here", index);
    expect(results).toHaveLength(0);
  });

  it("respects limit parameter", () => {
    const results = recommendComponents("revenue trend chart metric table data", index, 2);
    expect(results.length).toBeLessThanOrEqual(2);
  });
});