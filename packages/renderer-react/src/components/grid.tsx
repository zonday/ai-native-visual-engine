import type { SceneNode } from "@ai-native/core";
import type { RenderContext } from "../renderer.js";
import { resolveGridStyle } from "../layout-style.js";

export interface GridProps {
  node: SceneNode;
  ctx: RenderContext;
  children?: React.ReactNode;
}

export function GridNode({ node, children }: GridProps) {
  return (
    <div data-component="grid" style={resolveGridStyle(node)}>
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
