import type { SceneNode } from "@ai-native/core";
import type { RenderContext } from "../renderer.js";

export interface ContainerProps {
  node: SceneNode;
  ctx: RenderContext;
}

export function ContainerNode({ node }: ContainerProps) {
  const layout = node.layout as Record<string, unknown> | undefined;

  return (
    <div
      data-component="container"
      style={{
        display: "flex",
        flexDirection: (layout?.direction as React.CSSProperties["flexDirection"]) ?? "column",
        gap: (typeof layout?.gap === "number" ? layout.gap : 0) as number,
        padding: (typeof layout?.padding === "number" ? layout.padding : 8) as number,
        width: (typeof layout?.width === "number" ? layout.width : "100%") as number | string,
        height: (typeof layout?.height === "number" ? layout.height : "100%") as number | string,
      }}
    />
  );
}

export function registerContainer(registry: Map<string, unknown>) {
  registry.set("container", {
    type: "container",
    render: (node: SceneNode, _ctx: RenderContext) => ContainerNode({ node, ctx: _ctx }),
  });
}
