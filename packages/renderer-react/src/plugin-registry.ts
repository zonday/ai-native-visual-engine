import type { ComponentPlugin } from "@ai-native/core";

export const metricValuePlugin: ComponentPlugin = {
  type: "metric-value",
  renderer: () => null,
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

export const metricTrendPlugin: ComponentPlugin = {
  type: "metric-trend",
  renderer: () => null,
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

export const metricComparisonPlugin: ComponentPlugin = {
  type: "metric-comparison",
  renderer: () => null,
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

export const chartPlugin: ComponentPlugin = {
  type: "chart",
  renderer: () => null,
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

export const tablePlugin: ComponentPlugin = {
  type: "table",
  renderer: () => null,
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

export const headerPlugin: ComponentPlugin = {
  type: "header",
  renderer: () => null,
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

export const dividerPlugin: ComponentPlugin = {
  type: "divider",
  renderer: () => null,
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

export const filterPlugin: ComponentPlugin = {
  type: "filter",
  renderer: () => null,
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

export const allPluginDefinitions: ComponentPlugin[] = [
  metricValuePlugin,
  metricTrendPlugin,
  metricComparisonPlugin,
  chartPlugin,
  tablePlugin,
  headerPlugin,
  dividerPlugin,
  filterPlugin,
];
