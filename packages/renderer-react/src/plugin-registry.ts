import type { PluginDefinition } from "@ai-native/core";

export const metricValuePlugin: PluginDefinition = {
  meta: {
    type: "metric-value",
    title: "Metric Value",
    description: "Single KPI display with label and value.",
    category: "display",
    props: [
      { key: "label", type: "string", default: "Metric" },
      { key: "value", type: "number", default: 0 },
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
  constraints: [],
};

export const metricTrendPlugin: PluginDefinition = {
  meta: {
    type: "metric-trend",
    title: "Metric Trend",
    description: "Metric with sparkline and directional indicator.",
    category: "display",
    props: [
      { key: "label", type: "string", default: "Trend" },
      { key: "value", type: "number", default: 0 },
      { key: "trendData", type: "json", default: [] },
      { key: "trendDirection", type: "string", default: "flat" },
      { key: "changePercent", type: "number" },
    ],
    ai: {
      usage: ["revenue trend", "growth metric", "time-series KPI"],
      antiPatterns: ["using metric-trend with fewer than 3 data points"],
      relatedComponents: ["metric-value", "metric-comparison", "chart"],
    },
  },
  constraints: [{ type: "semantic", rule: "trendData.length >= 2" }],
};

export const metricComparisonPlugin: PluginDefinition = {
  meta: {
    type: "metric-comparison",
    title: "Metric Comparison",
    description: "Metric with comparison value and percentage change.",
    category: "display",
    props: [
      { key: "label", type: "string", default: "Comparison" },
      { key: "value", type: "number", default: 0 },
      { key: "compareValue", type: "number" },
      { key: "compareLabel", type: "string" },
      { key: "changePercent", type: "number" },
    ],
    ai: {
      usage: ["YoY comparison", "MoM change", "budget vs actual"],
      antiPatterns: [
        "using metric-comparison without compareValue or changePercent",
      ],
    },
  },
  constraints: [],
};

export const chartPlugin: PluginDefinition = {
  meta: {
    type: "chart",
    title: "Chart",
    description: "Line, bar, or pie chart driven by data bindings.",
    category: "display",
    props: [
      { key: "chartType", type: "string", default: "bar" },
      { key: "title", type: "string" },
      { key: "height", type: "number", default: 200 },
    ],
    ai: {
      usage: ["data visualization", "time-series plot", "distribution view"],
      antiPatterns: [
        "using chart without data binding",
        "pie chart with more than 10 categories",
      ],
    },
  },
  constraints: [
    { type: "semantic", rule: "chartType must be line, bar, or pie" },
  ],
};

export const tablePlugin: PluginDefinition = {
  meta: {
    type: "table",
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
      usage: ["data listing", "report table", "data export view"],
      antiPatterns: ["using table for layout", "table with 50+ columns"],
    },
  },
  constraints: [],
};

export const headerPlugin: PluginDefinition = {
  meta: {
    type: "header",
    title: "Header",
    description: "Page or section header with title and optional subtitle.",
    category: "layout",
    props: [
      { key: "title", type: "string", default: "Untitled" },
      { key: "subtitle", type: "string" },
      { key: "level", type: "number", default: 1 },
    ],
    ai: {
      usage: ["page title", "section heading", "dashboard title"],
      antiPatterns: [
        "using header without title text",
        "nesting headers too deeply (beyond h4)",
      ],
    },
  },
  constraints: [{ type: "semantic", rule: "level must be 1, 2, or 3" }],
};

export const dividerPlugin: PluginDefinition = {
  meta: {
    type: "divider",
    title: "Divider",
    description: "Visual separator between sections.",
    category: "layout",
    props: [
      { key: "label", type: "string" },
      { key: "orientation", type: "string", default: "horizontal" },
      { key: "style", type: "string", default: "solid" },
    ],
    ai: {
      usage: ["section separator", "visual grouping", "form partition"],
      antiPatterns: ["using multiple dividers in sequence"],
    },
  },
  constraints: [],
};

export const filterPlugin: PluginDefinition = {
  meta: {
    type: "filter",
    title: "Filter",
    description:
      "Interactive filter control driving data bindings on the same page.",
    category: "interaction",
    props: [
      { key: "filterType", type: "string", default: "dropdown" },
      { key: "label", type: "string", default: "Filter" },
      { key: "dataKey", type: "string" },
      { key: "placeholder", type: "string" },
      { key: "options", type: "json" },
    ],
    ai: {
      usage: ["data filtering", "dashboard interactivity", "search bar"],
      antiPatterns: [
        "using dropdown filter with 100+ options",
        "filter without data binding",
      ],
    },
  },
  constraints: [],
};

export const allPluginDefinitions: PluginDefinition[] = [
  metricValuePlugin,
  metricTrendPlugin,
  metricComparisonPlugin,
  chartPlugin,
  tablePlugin,
  headerPlugin,
  dividerPlugin,
  filterPlugin,
];
