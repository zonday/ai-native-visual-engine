import type { SceneNode } from "@ai-native/core";
import type { RenderContext } from "../renderer.js";

export interface GridProps {
  node: SceneNode;
  ctx: RenderContext;
  children?: React.ReactNode;
}

export function GridNode({ node, children }: GridProps) {
  const layout = node.layout;

  return (
    <div
      data-component="grid"
      style={{
        display: "grid",
        gridTemplateColumns: layout?.columns
          ? `repeat(${layout.columns}, 1fr)`
          : "repeat(auto-fill, minmax(100px, 1fr))",
        gap: (typeof layout?.gap === "number" ? layout.gap : 8) as number,
        padding: (typeof layout?.padding === "number" ? layout.padding : 8) as number,
        width: (typeof layout?.width === "number" ? layout.width : "100%") as number | string,
        height: (typeof layout?.height === "number" ? layout.height : "100%") as number | string,
      }}
    >
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
