import type { SceneNode } from "@ai-native/core";
import type { RenderContext } from "../renderer.js";

export interface GridProps {
  node: SceneNode;
  ctx: RenderContext;
  children?: React.ReactNode;
}

export function GridNode({ node, children }: GridProps) {
  const layout = node.layout;
  const style: React.CSSProperties = { display: "grid" };

  if (layout) {
    if (layout.columns) style.gridTemplateColumns = `repeat(${layout.columns}, 1fr)`;
    if (typeof layout.rowHeight === "number") style.gridAutoRows = layout.rowHeight;
    if (layout.autoFlow) style.gridAutoFlow = layout.autoFlow as React.CSSProperties["gridAutoFlow"];
    if (typeof layout.gap === "number") style.gap = layout.gap;
    if (typeof layout.padding === "number") style.padding = layout.padding;
    if (typeof layout.width === "number") style.width = layout.width;
    if (typeof layout.height === "number") style.height = layout.height;
  }

  return (
    <div data-component="grid" style={style}>
      {children}
    </div>
  );
}

export function registerGrid(registry: Map<string, unknown>) {
  registry.set("grid", {
    type: "grid",
    render: (node: SceneNode, _ctx: RenderContext, children?: React.ReactNode) =>
      GridNode({ node, ctx: _ctx, children }),
  });
}
