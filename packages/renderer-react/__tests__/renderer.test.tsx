import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import type { SceneGraph, SceneNode } from "@ai-native/core";
import { SceneRenderer } from "../src/scene-renderer.jsx";
import type { RenderContext, ComponentRegistry } from "../src/renderer.js";
import { ContainerNode } from "../src/components/container.jsx";
import { TextNode } from "../src/components/text.jsx";
import { MissingPluginPlaceholder } from "../src/components/missing-plugin.jsx";

const emptyScene: SceneGraph = {
  version: 0,
  rootId: "root",
  nodes: {
    root: { id: "root", type: "container", children: [] },
  },
};

const registry: ComponentRegistry = new Map();
registry.set("container", {
  type: "container",
  render: (node, ctx, children) =>
    ContainerNode({ node, ctx, children }),
});
registry.set("text", {
  type: "text",
  render: (node, ctx) => TextNode({ node, ctx }),
});

const context: RenderContext = {
  mode: "editor",
  pageId: "page-1",
  scene: emptyScene,
};

describe("SceneRenderer", () => {
  it("renders root node with container component", () => {
    const scene: SceneGraph = {
      version: 0,
      rootId: "root",
      nodes: {
        root: { id: "root", type: "container", children: [] },
      },
    };
    const ctx = { ...context, scene };
    const html = renderToString(
      <SceneRenderer registry={registry} context={ctx} />,
    );
    expect(html).toContain('data-component="container"');
  });

  it("renders text node", () => {
    const scene: SceneGraph = {
      version: 0,
      rootId: "root",
      nodes: {
        root: {
          id: "root",
          type: "container",
          children: ["text-1"],
        },
        "text-1": {
          id: "text-1",
          type: "text",
          parentId: "root",
          props: { text: "Hello" },
        },
      },
    };
    const ctx = { ...context, scene };
    const html = renderToString(
      <SceneRenderer registry={registry} context={ctx} />,
    );
    expect(html).toContain('data-component="text"');
    expect(html).toContain("Hello");
  });

  it("renders missing plugin placeholder for unknown type", () => {
    const scene: SceneGraph = {
      version: 0,
      rootId: "root",
      nodes: {
        root: {
          id: "root",
          type: "unknown-type",
          children: [],
        },
      },
    };
    const ctx = { ...context, scene };
    const html = renderToString(
      <SceneRenderer registry={registry} context={ctx} />,
    );
    expect(html).toContain("Unknown");
    expect(html).toContain("unknown-type");
  });

  it("does not render invisible nodes", () => {
    const scene: SceneGraph = {
      version: 0,
      rootId: "root",
      nodes: {
        root: {
          id: "root",
          type: "container",
          children: ["child-1"],
        },
        "child-1": {
          id: "child-1",
          type: "text",
          parentId: "root",
          visible: false,
        },
      },
    };
    const ctx = { ...context, scene };
    const html = renderToString(
      <SceneRenderer registry={registry} context={ctx} />,
    );
    expect(html).not.toContain('data-node-id="child-1"');
  });

  it("shows selection chrome in editor mode when selection matches", () => {
    const scene: SceneGraph = {
      version: 0,
      rootId: "root",
      nodes: {
        root: {
          id: "root",
          type: "container",
          children: [],
        },
      },
    };
    const ctx: RenderContext = {
      ...context,
      scene,
      selection: { nodeIds: ["root"] },
    };
    const html = renderToString(
      <SceneRenderer registry={registry} context={ctx} />,
    );
    expect(html).toContain('data-selection-chrome="root"');
  });

  it("does not show selection chrome in runtime mode even with selection", () => {
    const scene: SceneGraph = {
      version: 0,
      rootId: "root",
      nodes: {
        root: {
          id: "root",
          type: "container",
          children: [],
        },
      },
    };
    const ctx: RenderContext = {
      mode: "runtime",
      pageId: "page-1",
      scene,
      selection: { nodeIds: ["root"] },
    };
    const html = renderToString(
      <SceneRenderer registry={registry} context={ctx} />,
    );
    expect(html).not.toContain("data-selection-chrome");
  });

  it("renders marquee overlay when marqueeRect is provided in editor mode", () => {
    const scene: SceneGraph = {
      version: 0,
      rootId: "root",
      nodes: {
        root: {
          id: "root",
          type: "container",
          children: [],
        },
      },
    };
    const ctx: RenderContext = {
      ...context,
      scene,
      marqueeRect: { x: 10, y: 20, width: 300, height: 150 },
    };
    const html = renderToString(
      <SceneRenderer registry={registry} context={ctx} />,
    );
    expect(html).toContain("data-marquee-overlay");
  });

  it("does not render marquee overlay in runtime mode", () => {
    const scene: SceneGraph = {
      version: 0,
      rootId: "root",
      nodes: {
        root: {
          id: "root",
          type: "container",
          children: [],
        },
      },
    };
    const ctx: RenderContext = {
      mode: "runtime",
      pageId: "page-1",
      scene,
      marqueeRect: { x: 10, y: 20, width: 300, height: 150 },
    };
    const html = renderToString(
      <SceneRenderer registry={registry} context={ctx} />,
    );
    expect(html).not.toContain("data-marquee-overlay");
  });

  it("forwards onTransform and renders selected node with resize handles", () => {
    const scene: SceneGraph = {
      version: 0,
      rootId: "root",
      nodes: {
        root: {
          id: "root",
          type: "container",
          children: ["child-1"],
        },
        "child-1": {
          id: "child-1",
          type: "container",
          parentId: "root",
          layout: { mode: "absolute", x: 0, y: 0, width: 100, height: 100 },
        },
      },
    };
    const ctx: RenderContext = {
      ...context,
      scene,
      selection: { nodeIds: ["child-1"] },
    };
    const html = renderToString(
      <SceneRenderer
        registry={registry}
        context={ctx}
        onTransform={() => {}}
      />,
    );
    expect(html).toContain('data-node-id="child-1"');
    expect(html).toContain('data-handle="se"');
  });
});

describe("MissingPluginPlaceholder", () => {
  it("renders with unknown type name", () => {
    const html = renderToString(
      <MissingPluginPlaceholder nodeType="custom-widget" mode="editor" />,
    );
    expect(html).toContain("custom-widget");
    expect(html).toContain("Unknown");
  });
});
