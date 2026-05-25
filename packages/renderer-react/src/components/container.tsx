import type { SceneNode } from "@ai-native/core";
import { resolveFlexStyle } from "../layout-style.js";
import type { RenderContext } from "../renderer.js";

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
