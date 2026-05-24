import type { SceneNode } from "@ai-native/core";
import type { RenderContext } from "../renderer.js";
import { resolveLayoutStyle } from "../layout-style.js";

export interface ContainerProps {
  node: SceneNode;
  ctx: RenderContext;
  children?: React.ReactNode;
}

export function ContainerNode({ node, children }: ContainerProps) {
  const style = resolveLayoutStyle(node);
  if (!style.display) style.display = "flex";

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
