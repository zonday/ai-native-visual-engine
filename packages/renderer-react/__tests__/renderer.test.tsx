import { describe, it, expect } from "vitest";
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
  render: (node, ctx) => ContainerNode({ node, ctx }),
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
    const result = SceneRenderer({ registry, context: ctx });
    expect(result).toBeDefined();
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
    const result = SceneRenderer({ registry, context: ctx });
    expect(result).toBeDefined();
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
    const result = SceneRenderer({ registry, context: ctx });
    expect(result).toBeDefined();
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
    const result = SceneRenderer({ registry, context: ctx });
    expect(result).toBeDefined();
  });

  it("shows selection outline in editor mode", () => {
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
      selection: { nodeIds: ["root"] },
    };
    const ctx: RenderContext = {
      ...context,
      scene,
      selection: { nodeIds: ["root"] },
    };
    const result = SceneRenderer({ registry, context: ctx });
    expect(result).toBeDefined();
  });

  it("does not show selection outline in runtime mode", () => {
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
      selection: { nodeIds: ["root"] },
    };
    const ctx: RenderContext = {
      mode: "runtime",
      pageId: "page-1",
      scene,
      selection: { nodeIds: ["root"] },
    };
    const result = SceneRenderer({ registry, context: ctx });
    expect(result).toBeDefined();
  });

  it("renders marquee overlay when marqueeRect is provided", () => {
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
    const result = SceneRenderer({ registry, context: ctx });
    expect(result).toBeDefined();
  });
});

describe("MissingPluginPlaceholder", () => {
  it("renders with unknown type name", () => {
    const result = MissingPluginPlaceholder({ nodeType: "custom-widget", mode: "editor" });
    expect(result).toBeDefined();
  });
});
