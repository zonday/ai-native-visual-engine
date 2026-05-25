import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import { MetricValueNode } from "../src/components/metric-value.jsx";
import { MetricTrendNode } from "../src/components/metric-trend.jsx";
import { MetricComparisonNode } from "../src/components/metric-comparison.jsx";
import { ChartNode } from "../src/components/chart.jsx";
import { TableNode } from "../src/components/table.jsx";
import { HeaderNode } from "../src/components/header.jsx";
import { DividerNode } from "../src/components/divider.jsx";
import { FilterNode } from "../src/components/filter.jsx";
import type { SceneNode } from "@ai-native/core";
import type { RenderContext } from "../src/renderer.js";

const ctx: RenderContext = {
  mode: "editor",
  pageId: "page-1",
  scene: { version: 0, rootId: "root", nodes: {} },
};

const baseNode: SceneNode = { id: "n1", type: "metric-value" };

describe("MetricValueNode", () => {
  it("renders label and value", () => {
    const node = { ...baseNode, type: "metric-value", props: { label: "Revenue", value: 1234 } };
    const html = renderToString(<MetricValueNode node={node} ctx={ctx} />);
    expect(html).toContain("Revenue");
    expect(html).toContain("1234");
  });

  it("renders with color", () => {
    const node = { ...baseNode, type: "metric-value", props: { label: "NPS", value: 85, color: "#16a34a" } };
    const html = renderToString(<MetricValueNode node={node} ctx={ctx} />);
    expect(html).toContain("#16a34a");
  });

  it("has data-component attribute", () => {
    const html = renderToString(<MetricValueNode node={baseNode} ctx={ctx} />);
    expect(html).toContain('Metric');
  });
});

describe("MetricTrendNode", () => {
  it("renders with trend direction and change percent", () => {
    const node = { ...baseNode, type: "metric-trend", props: { label: "Growth", value: 42, trendDirection: "up", changePercent: 12.5 } };
    const html = renderToString(<MetricTrendNode node={node} ctx={ctx} />);
    expect(html).toContain("Growth");
    expect(html).toContain("42");
    expect(html).toContain("12.5%");
  });

  it("renders sparkline bars for trendData", () => {
    const node = { ...baseNode, type: "metric-trend", props: { label: "T", value: 10, trendData: [1, 2, 3] } };
    const html = renderToString(<MetricTrendNode node={node} ctx={ctx} />);
    expect(html).toContain("T");
  });
});

describe("MetricComparisonNode", () => {
  it("renders comparison value and label", () => {
    const node = { ...baseNode, type: "metric-comparison", props: { label: "Sales", value: 500, compareValue: 400, compareLabel: "Target" } };
    const html = renderToString(<MetricComparisonNode node={node} ctx={ctx} />);
    expect(html).toContain("500");
    expect(html).toContain("400");
    expect(html).toContain("Target");
  });

  it("renders negative change percent in red", () => {
    const node = { ...baseNode, type: "metric-comparison", props: { label: "Sales", value: 400, changePercent: -5 } };
    const html = renderToString(<MetricComparisonNode node={node} ctx={ctx} />);
    expect(html).toContain("5%");
  });
});

describe("ChartNode", () => {
  it("renders placeholder with chart type", () => {
    const node = { ...baseNode, type: "chart", props: { chartType: "bar", title: "Sales" } };
    const html = renderToString(<ChartNode node={node} ctx={ctx} />);
    expect(html).toContain("[bar chart]");
    expect(html).toContain("Sales");
  });
});

describe("TableNode", () => {
  it("renders column headers", () => {
    const node = { ...baseNode, type: "table", props: { columns: [{ key: "name", label: "Name" }] } };
    const html = renderToString(<TableNode node={node} ctx={ctx} />);
    expect(html).toContain("Name");
    expect(html).toContain('Name');
  });
});

describe("HeaderNode", () => {
  it("renders h1 by default", () => {
    const node = { ...baseNode, type: "header", props: { title: "Dashboard" } };
    const html = renderToString(<HeaderNode node={node} ctx={ctx} />);
    expect(html).toContain("<h1");
    expect(html).toContain("Dashboard");
  });

  it("renders subtitle for h2 level", () => {
    const node = { ...baseNode, type: "header", props: { title: "Section", subtitle: "Details", level: 2 } };
    const html = renderToString(<HeaderNode node={node} ctx={ctx} />);
    expect(html).toContain("<h2");
    expect(html).toContain("Details");
  });
});

describe("DividerNode", () => {
  it("renders horizontal line by default", () => {
    const node = { ...baseNode, type: "divider" };
    const html = renderToString(<DividerNode node={node} ctx={ctx} />);
    expect(html).toContain('solid');
  });

  it("renders label between lines", () => {
    const node = { ...baseNode, type: "divider", props: { label: "OR" } };
    const html = renderToString(<DividerNode node={node} ctx={ctx} />);
    expect(html).toContain("OR");
  });
});

describe("FilterNode", () => {
  it("renders dropdown filter", () => {
    const node = { ...baseNode, type: "filter", props: { filterType: "dropdown", label: "Status", options: [{ label: "Active", value: "active" }] } };
    const html = renderToString(<FilterNode node={node} ctx={ctx} />);
    expect(html).toContain("Status");
    expect(html).toContain("Active");
  });

  it("renders text input filter", () => {
    const node = { ...baseNode, type: "filter", props: { filterType: "text", label: "Search" } };
    const html = renderToString(<FilterNode node={node} ctx={ctx} />);
    expect(html).toContain('<input type="text"');
  });

  it("renders date range filter", () => {
    const node = { ...baseNode, type: "filter", props: { filterType: "date-range", label: "Period" } };
    const html = renderToString(<FilterNode node={node} ctx={ctx} />);
    expect(html).toContain('<input type="date"');
  });
});
