import { createRoot } from "react-dom/client";
import {
  createNewDocument,
  type VisualDocument,
  type ComponentPlugin,
} from "@ai-native/core";
import {
  type ComponentRegistry,
  createRendererRegistry,
} from "@ai-native/renderer-react";
import { Editor } from "./Editor.js";

const doc = createNewDocument({ title: "My Dashboard" });

const plugins: ComponentPlugin[] = [
  {
    type: "container", name: "Container", description: "Layout container",
    defaultProps: {}, defaultLayout: { mode: "free" },
    render: () => ({ type: "react", element: "<div />" }),
  },
  {
    type: "text", name: "Text", description: "Text block",
    defaultProps: { content: "Hello World" }, defaultLayout: { mode: "free" },
    render: () => ({ type: "react", element: "<span />" }),
  },
  {
    type: "grid", name: "Grid", description: "Grid layout",
    defaultProps: {}, defaultLayout: { mode: "grid", columns: 12 },
    render: () => ({ type: "react", element: "<div />" }),
  },
  {
    type: "metric-value", name: "Metric Value", description: "KPI number",
    defaultProps: { value: 0, label: "Metric" },
    defaultLayout: { mode: "grid-item", w: 4, h: 3 },
    render: () => ({ type: "react", element: "<div />" }),
  },
  {
    type: "chart", name: "Chart", description: "Data chart",
    defaultProps: {}, defaultLayout: { mode: "grid-item", w: 8, h: 4 },
    render: () => ({ type: "react", element: "<div />" }),
  },
  {
    type: "header", name: "Header", description: "Section header",
    defaultProps: { text: "Header" }, defaultLayout: { mode: "grid-item", w: 12, h: 1 },
    render: () => ({ type: "react", element: "<h2 />" }),
  },
];

const registry = createRendererRegistry(plugins);

const root = createRoot(document.getElementById("root")!);
root.render(
  <Editor
    document={doc}
    registry={registry}
    context={{ pageId: doc.pages[0]?.sceneId ?? "", mode: "editor" }}
  />,
);
