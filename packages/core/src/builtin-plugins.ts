import type { ComponentPlugin } from "./plugin-types.js";

export const containerPlugin: ComponentPlugin = {
  type: "container",
  renderer: () => null,
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

export const gridPlugin: ComponentPlugin = {
  type: "grid",
  renderer: () => null,
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

export const textPlugin: ComponentPlugin = {
  type: "text",
  renderer: () => null,
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

export const builtinPluginDefinitions: ComponentPlugin[] = [
  containerPlugin,
  gridPlugin,
  textPlugin,
];
