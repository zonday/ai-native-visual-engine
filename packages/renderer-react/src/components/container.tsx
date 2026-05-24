import type { SceneNode } from "@ai-native/core";
import type { RenderContext } from "../renderer.js";
import { resolveFlexStyle } from "../layout-style.js";

export interface ContainerProps {
  node: SceneNode;
  ctx: RenderContext;
  children?: React.ReactNode;
}

export function ContainerNode({ node, children }: ContainerProps) {
  return (
    <div data-component="container" style={resolveFlexStyle(node)}>
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
