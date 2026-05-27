import type { ComponentPlugin, SceneNode } from "@ai-native/core";
import type { ReactNode } from "react";
import { ChartNode } from "./components/chart.jsx";
import { ContainerNode } from "./components/container.jsx";
import { DividerNode } from "./components/divider.jsx";
import { FilterNode } from "./components/filter.jsx";
import { GridNode } from "./components/grid.jsx";
import { HeaderNode } from "./components/header.jsx";
import { MetricComparisonNode } from "./components/metric-comparison.jsx";
import { MetricTrendNode } from "./components/metric-trend.jsx";
import { MetricValueNode } from "./components/metric-value.jsx";
import { TableNode } from "./components/table.jsx";
import { TextNode } from "./components/text.jsx";
import type {
  ComponentRegistry,
  ComponentRenderer,
  RenderContext,
} from "./renderer.js";

type NodeRenderFn = (props: {
  node: SceneNode;
  ctx: RenderContext;
  children?: ReactNode;
}) => ReactNode;

function makeRenderer(Component: NodeRenderFn): ComponentPlugin["renderer"] {
  return (node, ctx, children) =>
    Component({
      node,
      ctx: ctx as RenderContext,
      children: children as ReactNode,
    });
}

function registerPlugins(
  registry: ComponentRegistry,
  plugins: ComponentPlugin[],
): void {
  for (const plugin of plugins) {
    registry.set(plugin.type, {
      type: plugin.type,
      render: plugin.renderer as ComponentRenderer["render"],
    });
  }
}

// ── Built-in types (always available, cannot be unregistered) ──

const containerPlugin: ComponentPlugin = {
  type: "container",
  renderer: makeRenderer(ContainerNode),
  meta: {
    title: "Container",
    description: "Generic flex layout container for grouping child nodes.",
    category: "container",
    props: [],
    ai: {
      usage: ["grouping related widgets", "dashboard section wrapper"],
      antiPatterns: ["using container for single-child layout only"],
    },
  },
  constraints: [{ type: "structural", rule: "children.length >= 0" }],
};

const gridPlugin: ComponentPlugin = {
  type: "grid",
  renderer: makeRenderer(GridNode),
  meta: {
    title: "Grid",
    description: "Responsive grid layout container.",
    category: "container",
    props: [],
    ai: {
      usage: ["dashboard page layout", "KPI card grid", "chart grid"],
      antiPatterns: [
        "placing grid inside another grid without explicit intention",
      ],
    },
  },
  constraints: [
    { type: "layout", rule: "columns >= 1" },
    { type: "layout", rule: "rowHeight >= 1" },
    { type: "layout", rule: "all children must use grid-item layout" },
  ],
};

const textPlugin: ComponentPlugin = {
  type: "text",
  renderer: makeRenderer(TextNode),
  meta: {
    title: "Text",
    description:
      "Rich text block powered by Tiptap. Supports headings, lists, inline formatting, and links.",
    category: "display",
    props: [
      {
        key: "content",
        type: "json",
        default: '{"type":"doc","content":[{"type":"paragraph"}]}',
      },
      { key: "placeholder", type: "string" },
      { key: "editable", type: "boolean", default: true },
    ],
    ai: {
      usage: [
        "page title",
        "section description",
        "annotation",
        "data footnote",
      ],
      antiPatterns: [
        "using text block for structured data that belongs in a table or chart",
      ],
    },
  },
  constraints: [
    {
      type: "structural",
      rule: "content must be a valid Tiptap JSON document",
    },
  ],
};

// ── Default plugins ──

const metricValuePlugin: ComponentPlugin = {
  type: "metric-value",
  renderer: makeRenderer(MetricValueNode),
  meta: {
    title: "Metric Value",
    description: "Single metric display with label and value.",
    category: "display",
    props: [
      { key: "label", type: "string", default: "Metric" },
      { key: "value", type: "number", default: 0 },
      { key: "format", type: "string", default: "number" },
      { key: "prefix", type: "string" },
      { key: "suffix", type: "string" },
      { key: "color", type: "string" },
    ],
    ai: {
      usage: ["single KPI display", "summary statistic", "total count"],
      antiPatterns: [
        "using metric-value when trend or comparison context is needed",
      ],
    },
  },
  constraints: [
    { type: "semantic", rule: "value must be a valid number or string" },
  ],
};

const metricTrendPlugin: ComponentPlugin = {
  type: "metric-trend",
  renderer: makeRenderer(MetricTrendNode),
  meta: {
    title: "Metric Trend",
    description: "Metric with inline sparkline and directional indicator.",
    category: "display",
    props: [
      { key: "label", type: "string", default: "Trend" },
      { key: "value", type: "number", default: 0 },
      { key: "trendData", type: "json", default: [] },
      { key: "trendDirection", type: "string", default: "flat" },
      { key: "changePercent", type: "number" },
      { key: "format", type: "string", default: "number" },
    ],
    ai: {
      usage: ["revenue trend", "growth metric", "time-series KPI"],
      antiPatterns: ["using metric-trend with fewer than 3 data points"],
      relatedComponents: ["metric-value", "metric-comparison", "chart"],
    },
  },
  constraints: [{ type: "semantic", rule: "trendData.length >= 2" }],
};

const metricComparisonPlugin: ComponentPlugin = {
  type: "metric-comparison",
  renderer: makeRenderer(MetricComparisonNode),
  meta: {
    title: "Metric Comparison",
    description: "Metric with comparison value and percentage change.",
    category: "display",
    props: [
      { key: "label", type: "string", default: "Comparison" },
      { key: "value", type: "number", default: 0 },
      { key: "compareValue", type: "number" },
      { key: "compareLabel", type: "string" },
      { key: "changePercent", type: "number" },
      { key: "format", type: "string", default: "number" },
    ],
    ai: {
      usage: ["YoY comparison", "MoM change", "budget vs actual"],
      antiPatterns: [
        "using metric-comparison without providing compareValue or changePercent",
      ],
      relatedComponents: ["metric-value", "metric-trend"],
    },
  },
  constraints: [
    {
      type: "semantic",
      rule: "at least one of compareValue or changePercent should be present",
    },
  ],
};

const chartPlugin: ComponentPlugin = {
  type: "chart",
  renderer: makeRenderer(ChartNode),
  meta: {
    title: "Chart",
    description: "Line, bar, or pie chart driven by data bindings.",
    category: "display",
    props: [
      { key: "chartType", type: "string", default: "bar" },
      { key: "xKey", type: "string" },
      { key: "yKey", type: "string" },
      { key: "title", type: "string" },
      { key: "stacked", type: "boolean", default: false },
      { key: "showLegend", type: "boolean", default: true },
      { key: "height", type: "number", default: 300 },
    ],
    ai: {
      usage: ["revenue by month", "sales by region", "category breakdown"],
      antiPatterns: [
        "using pie chart for more than 10 categories",
        "using bar chart for time-series data",
      ],
      relatedComponents: ["metric-value", "table"],
    },
  },
  constraints: [
    { type: "semantic", rule: "must have data binding to a dataset" },
    { type: "layout", rule: "height >= 100" },
  ],
};

const tablePlugin: ComponentPlugin = {
  type: "table",
  renderer: makeRenderer(TableNode),
  meta: {
    title: "Table",
    description: "Paginated data table driven by data bindings.",
    category: "display",
    props: [
      { key: "columns", type: "json" },
      { key: "pageSize", type: "number", default: 20 },
      { key: "sortable", type: "boolean", default: true },
      { key: "striped", type: "boolean", default: true },
    ],
    ai: {
      usage: ["detailed data view", "transaction list", "raw data inspection"],
      antiPatterns: [
        "using table for a single row of data",
        "using table when a chart is more appropriate",
      ],
      relatedComponents: ["chart"],
    },
  },
  constraints: [
    { type: "semantic", rule: "must have data binding to a dataset" },
  ],
};

const headerPlugin: ComponentPlugin = {
  type: "header",
  renderer: makeRenderer(HeaderNode),
  meta: {
    title: "Header",
    description: "Page or section header with title and optional subtitle.",
    category: "layout",
    props: [
      { key: "title", type: "string", default: "Untitled" },
      { key: "subtitle", type: "string" },
      { key: "level", type: "number", default: 1 },
    ],
    ai: {
      usage: ["page title", "dashboard name", "section heading"],
      antiPatterns: ["using header for body text"],
    },
  },
};

const dividerPlugin: ComponentPlugin = {
  type: "divider",
  renderer: makeRenderer(DividerNode),
  meta: {
    title: "Divider",
    description: "Visual separator between sections.",
    category: "layout",
    props: [
      { key: "label", type: "string" },
      { key: "orientation", type: "string", default: "horizontal" },
      { key: "style", type: "string", default: "solid" },
    ],
    ai: {
      usage: ["section separator", "visual grouping boundary"],
      antiPatterns: ["using multiple dividers without content between them"],
    },
  },
};

const filterPlugin: ComponentPlugin = {
  type: "filter",
  renderer: makeRenderer(FilterNode),
  meta: {
    title: "Filter",
    description:
      "Interactive filter control that drives data bindings on the same page.",
    category: "interaction",
    props: [
      { key: "filterType", type: "string", default: "dropdown" },
      { key: "label", type: "string", default: "Filter" },
      { key: "dataKey", type: "string" },
      { key: "placeholder", type: "string" },
      { key: "options", type: "json" },
    ],
    ai: {
      usage: ["date filter for dashboard", "category selector", "search box"],
      antiPatterns: [
        "placing filter on a different page from the data it affects",
      ],
    },
  },
  constraints: [
    {
      type: "semantic",
      rule: "dataKey must reference a variable or dataset column",
    },
  ],
};

// ── Exports ──

export const builtinPluginDefinitions: ComponentPlugin[] = [
  containerPlugin,
  gridPlugin,
  textPlugin,
];

export const allPluginDefinitions: ComponentPlugin[] = [
  ...builtinPluginDefinitions,
  metricValuePlugin,
  metricTrendPlugin,
  metricComparisonPlugin,
  chartPlugin,
  tablePlugin,
  headerPlugin,
  dividerPlugin,
  filterPlugin,
];

export function registerBuiltinPlugins(registry: ComponentRegistry): void {
  registerPlugins(registry, builtinPluginDefinitions);
}

export function registerDefaultPlugins(registry: ComponentRegistry): void {
  registerPlugins(registry, allPluginDefinitions);
}

export function createRendererRegistry(
  plugins: ComponentPlugin[] = allPluginDefinitions,
): ComponentRegistry {
  const registry: ComponentRegistry = new Map();
  registerPlugins(registry, plugins);
  return registry;
}
