import type { PluginDefinition } from "./plugin-types.js";

export const containerPlugin: PluginDefinition = {
  meta: {
    type: "container",
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

export const gridPlugin: PluginDefinition = {
  meta: {
    type: "grid",
    title: "Grid",
    description: "CSS grid layout container with configurable columns.",
    category: "container",
    props: [
      { key: "columns", type: "number", default: 12 },
      { key: "rowHeight", type: "number" },
      { key: "gap", type: "number", default: 8 },
      { key: "autoFlow", type: "string", default: "row" },
      { key: "padding", type: "number" },
    ],
    ai: {
      usage: ["dashboard grid", "card layout", "gallery", "responsive grid"],
      antiPatterns: ["using grid without grid-item children"],
    },
  },
  constraints: [
    { type: "structural", rule: "children must be grid-item layout" },
  ],
};

export const textPlugin: PluginDefinition = {
  meta: {
    type: "text",
    title: "Text",
    description:
      "Rich text block powered by Tiptap. Supports headings, lists, inline formatting, and links.",
    category: "display",
    props: [
      { key: "content", type: "json" },
      { key: "placeholder", type: "string" },
      { key: "editable", type: "boolean", default: true },
    ],
    ai: {
      usage: [
        "text content",
        "descriptions",
        "narrative sections",
        "rich text blocks",
      ],
      antiPatterns: [
        "using text for data display instead of metric components",
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

export const builtinPluginDefinitions: PluginDefinition[] = [
  containerPlugin,
  gridPlugin,
  textPlugin,
];
