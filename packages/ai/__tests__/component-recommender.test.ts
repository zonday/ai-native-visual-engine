import type { AiSchemaIndexSnapshot } from "@ai-native/core";
import { describe, expect, it } from "vitest";
import { enrichCreateDashboardDescription } from "../src/component-recommender.js";

const index: AiSchemaIndexSnapshot = {
  components: {
    "metric-value": {
      type: "metric-value",
      name: "Metric Value",
      description: "Displays a single metric value",
      props: [],
      ai: {
        keywords: ["revenue", "metric", "kpi"],
        usage: ["display a single number"],
        antiPatterns: ["complex chart"],
      },
    },
    chart: {
      type: "chart",
      name: "Chart",
      description: "Visualizes data as a chart",
      props: [],
      ai: {
        keywords: ["chart", "trend", "bar"],
        usage: ["visualize data", "show trend"],
      },
    },
  },
  componentTypes: ["metric-value", "chart"],
};

describe("enrichCreateDashboardDescription", () => {
  it("includes component types in output", () => {
    const result = enrichCreateDashboardDescription(
      "Create a dashboard",
      index,
    );
    expect(result).toContain("metric-value");
    expect(result).toContain("chart");
  });

  it("includes base description", () => {
    const result = enrichCreateDashboardDescription("My description", index);
    expect(result).toContain("My description");
  });

  it("includes AI metadata when present", () => {
    const result = enrichCreateDashboardDescription("Base", index);
    expect(result).toContain("Keywords: revenue");
    expect(result).toContain("Best for: visualize data");
    expect(result).toContain("Avoid for: complex chart");
  });

  it("handles empty index", () => {
    const result = enrichCreateDashboardDescription("Base", {
      components: {},
      componentTypes: [],
    });
    expect(result).toContain("Base");
    expect(result).toContain("Available widget types:");
  });
});
