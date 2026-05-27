// @vitest-environment happy-dom

import type { SceneGraph } from "@ai-native/core";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ContainerNode } from "../src/components/container.jsx";
import { MissingPluginPlaceholder } from "../src/components/missing-plugin.jsx";
import { TextNode } from "../src/components/text.jsx";
import type { ComponentRegistry, RenderContext } from "../src/renderer.js";
import { SceneRenderer } from "../src/scene-renderer.jsx";

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
  render: (node, ctx, children) => ContainerNode({ node, ctx, children }),
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
          props: {
            content: {
              type: "doc",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Hello" }],
                },
              ],
            },
          },
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

  it("shows move cursor on wrapper when a selected absolute node is transformable", () => {
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
    expect(html).toContain("cursor:move");
  });

  it("does not show move cursor on locked selected node", () => {
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
    expect(html).not.toContain("cursor:move");
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
  it("fires onSelectNode on an unselected sibling after a drag-commit mouseup", {
    timeout: 5000,
  }, async () => {
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
  });
});

describe("SceneRenderer — viewport transform", () => {
  const scene: SceneGraph = {
    version: 0,
    rootId: "root",
    nodes: {
      root: { id: "root", type: "container", children: [] },
    },
  };

  it("applies scale and translate transform for zoomed viewport in editor mode", () => {
    const ctx: RenderContext = {
      mode: "editor",
      pageId: "page-1",
      scene,
      viewport: { zoom: 2, x: 100, y: 50 },
    };
    const html = renderToString(
      <SceneRenderer registry={registry} context={ctx} />,
    );
    expect(html).toContain("scale(2)");
    expect(html).toContain("translate(-100px, -50px)");
    expect(html).toContain("transform-origin:0 0");
  });

  it("does not apply viewport transform for identity viewport (zoom=1, x=0, y=0)", () => {
    const ctx: RenderContext = {
      mode: "editor",
      pageId: "page-1",
      scene,
      viewport: { zoom: 1, x: 0, y: 0 },
    };
    const html = renderToString(
      <SceneRenderer registry={registry} context={ctx} />,
    );
    expect(html).not.toContain("transform-origin");
  });

  it("treats zoom=0 as zoom=1 to avoid division by zero", () => {
    const ctx: RenderContext = {
      mode: "editor",
      pageId: "page-1",
      scene,
      viewport: { zoom: 0, x: 0, y: 0 },
    };
    const html = renderToString(
      <SceneRenderer registry={registry} context={ctx} />,
    );
    // zoom=0 triggers the safety guard: viewportStyle is undefined (identity)
    expect(html).not.toContain("transform-origin");
  });

  it("does not apply viewport transform when viewport is absent", () => {
    const ctx: RenderContext = {
      mode: "editor",
      pageId: "page-1",
      scene,
    };
    const html = renderToString(
      <SceneRenderer registry={registry} context={ctx} />,
    );
    expect(html).not.toContain("transform-origin");
  });

  it("does not apply viewport transform in runtime mode", () => {
    const ctx: RenderContext = {
      mode: "runtime",
      pageId: "page-1",
      scene,
      viewport: { zoom: 2, x: 100, y: 50 },
    };
    const html = renderToString(
      <SceneRenderer registry={registry} context={ctx} />,
    );
    expect(html).not.toContain("transform-origin");
  });
});

describe("SceneRenderer — zoom-adjusted deltas", () => {
  it("emits content-space deltas for move drag under viewport zoom=2", {
    timeout: 5000,
  }, async () => {
    const { render, fireEvent } = await import("@testing-library/react");

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

    const onTransform = vi.fn();

    const { getByTestId } = render(
      <div data-testid="zoom-root-wrapper">
        <SceneRenderer
          registry={registry}
          context={{
            mode: "editor",
            pageId: "page-1",
            scene,
            selection: { nodeIds: ["child-1"] },
            viewport: { zoom: 2, x: 0, y: 0 },
          }}
          onTransform={onTransform}
        />
      </div>,
    );

    const nodeEl = getByTestId("zoom-root-wrapper").querySelector(
      '[data-node-id="child-1"]',
    ) as HTMLElement;
    fireEvent.mouseDown(nodeEl, { button: 0, clientX: 100, clientY: 100 });
    // Move 20 screen pixels → 10 content pixels at zoom=2
    fireEvent.mouseMove(window, { clientX: 120, clientY: 120 });
    fireEvent.mouseUp(window, { clientX: 120, clientY: 120 });

    expect(onTransform).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "move",
        commit: false,
        deltaX: 10,
        deltaY: 10,
      }),
    );
    expect(onTransform).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "move",
        commit: true,
        deltaX: 10,
        deltaY: 10,
      }),
    );
  });

  it("does not crash for move drag with zoom=0 (guarded to zoom=1)", {
    timeout: 5000,
  }, async () => {
    const { render, fireEvent } = await import("@testing-library/react");

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

    const onTransform = vi.fn();

    const { getByTestId } = render(
      <div data-testid="zero-zoom-wrapper">
        <SceneRenderer
          registry={registry}
          context={{
            mode: "editor",
            pageId: "page-1",
            scene,
            selection: { nodeIds: ["child-1"] },
            viewport: { zoom: 0, x: 0, y: 0 },
          }}
          onTransform={onTransform}
        />
      </div>,
    );

    const nodeEl = getByTestId("zero-zoom-wrapper").querySelector(
      '[data-node-id="child-1"]',
    ) as HTMLElement;
    fireEvent.mouseDown(nodeEl, { button: 0, clientX: 50, clientY: 50 });
    fireEvent.mouseMove(window, { clientX: 60, clientY: 60 });
    fireEvent.mouseUp(window, { clientX: 60, clientY: 60 });

    // zoom=0 guarded to 1, so 10 screen pixels → 10 content deltas
    expect(onTransform).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "move",
        commit: false,
        deltaX: 10,
        deltaY: 10,
      }),
    );
  });
});
