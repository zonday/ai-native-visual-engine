import type { SceneNode } from "@ai-native/core";
import { resolveGridStyle } from "../layout-style.js";
import type { RenderContext } from "../renderer.js";

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
