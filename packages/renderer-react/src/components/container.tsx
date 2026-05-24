import type { SceneNode } from "@ai-native/core";
import type { RenderContext } from "../renderer.js";

export interface ContainerProps {
  node: SceneNode;
  ctx: RenderContext;
  children?: React.ReactNode;
}

export function ContainerNode({ node, children }: ContainerProps) {
  const layout = node.layout;
  const style: React.CSSProperties = { display: "flex" };

  if (layout) {
    if (layout.direction) style.flexDirection = layout.direction as React.CSSProperties["flexDirection"];
    if (typeof layout.gap === "number") style.gap = layout.gap;
    if (typeof layout.padding === "number") style.padding = layout.padding;
    if (typeof layout.width === "number") style.width = layout.width;
    if (typeof layout.height === "number") style.height = layout.height;
  }

  return (
    <div data-component="container" style={style}>
      {children}
    </div>
  );
}

export function registerContainer(registry: Map<string, unknown>) {
  registry.set("container", {
    type: "container",
    render: (node: SceneNode, _ctx: RenderContext, children?: React.ReactNode) =>
      ContainerNode({ node, ctx: _ctx, children }),
  });
}
