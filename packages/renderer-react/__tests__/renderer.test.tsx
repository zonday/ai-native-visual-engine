// @vitest-environment happy-dom
import { describe, it, expect, vi } from "vitest";
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

  it("shows selection chrome for a selected absolute-layout node in editor mode", () => {
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
      <SceneRenderer registry={registry} context={ctx} />,
    );
    expect(html).toContain('data-selection-chrome="child-1"');
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

  it("does not render transform handles for a selected locked node", () => {
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
          locked: true,
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
    expect(html).not.toContain("data-handle");
    // Locked wrapper must have pointer-events:none so it cannot receive gestures
    expect(html).toContain("pointer-events:none");
  });

  it("does not render transform handles for a selected node without a transformable layout mode", () => {
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
    expect(html).not.toContain("data-handle");
  });

  it("renders transform handles for a selected node with grid-item layout mode", () => {
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
          layout: { mode: "grid-item" },
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
    expect(html).toContain("data-handle");
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

// Fix 2 regression: didDragRef must be reset by mouseup so the next genuine click
// is not suppressed. Requires a DOM environment (happy-dom) to exercise useEffect
// and synthetic window events.
describe("SceneRenderer — didDragRef reset (Fix 2)", () => {
  it(
    "fires onSelectNode on an unselected sibling after a drag-commit mouseup",
    { timeout: 5000 },
    async () => {
      const { render, fireEvent } = await import("@testing-library/react");

      const scene: SceneGraph = {
        version: 0,
        rootId: "root",
        nodes: {
          root: {
            id: "root",
            type: "container",
            children: ["child-1", "child-2"],
          },
          "child-1": {
            id: "child-1",
            type: "container",
            parentId: "root",
            layout: { mode: "absolute", x: 0, y: 0, width: 100, height: 100 },
          },
          "child-2": {
            id: "child-2",
            type: "container",
            parentId: "root",
            layout: { mode: "absolute", x: 200, y: 0, width: 100, height: 100 },
          },
        },
      };

      const onSelectNode = vi.fn();
      const onTransform = vi.fn();

      const { getByTestId } = render(
        <div data-testid="root-wrapper">
          <SceneRenderer
            registry={registry}
            context={{
              ...context,
              scene,
              selection: { nodeIds: ["child-1"] },
            }}
            onSelectNode={onSelectNode}
            onTransform={onTransform}
          />
        </div>,
      );

      const nodeEl = getByTestId("root-wrapper").querySelector(
        '[data-node-id="child-1"]',
      ) as HTMLElement;
      fireEvent.mouseDown(nodeEl, { button: 0, clientX: 50, clientY: 50 });
      fireEvent.mouseMove(window, { clientX: 60, clientY: 60 });
      fireEvent.mouseUp(window, { clientX: 60, clientY: 60 });

      // Drag must have emitted move + commit events.
      expect(onTransform).toHaveBeenCalledWith(
        expect.objectContaining({ type: "move", commit: false }),
      );
      expect(onTransform).toHaveBeenCalledWith(
        expect.objectContaining({ type: "move", commit: true }),
      );

      // Click on an unselected sibling — must NOT be suppressed by stale didDragRef.
      // fireEvent.click alone does NOT dispatch mousedown; we must fire mousedown
      // explicitly so sceneMouseDown resets didDragRef before the click handler runs.
      onSelectNode.mockClear();
      const child2El = getByTestId("root-wrapper").querySelector(
        '[data-node-id="child-2"]',
      ) as HTMLElement;
      fireEvent.mouseDown(child2El, { button: 0 });
      fireEvent.mouseUp(child2El, { button: 0 });
      fireEvent.click(child2El);

      expect(onSelectNode).toHaveBeenCalledWith(
        "child-2",
        expect.objectContaining({ additive: false }),
      );
    },
  );
});

