import type { SceneNode } from "@ai-native/core";
import type { RenderContext } from "../renderer.js";

export interface TextProps {
  node: SceneNode;
  ctx: RenderContext;
}

export function TextNode({ node }: TextProps) {
  const text = (node.props as Record<string, unknown> | undefined)?.text as string | undefined;

  return (
    <div
      data-component="text"
      style={{
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
      }}
    >
      {text ?? ""}
    </div>
  );
}

export function registerText(registry: Map<string, unknown>) {
  registry.set("text", {
    type: "text",
    render: (node: SceneNode, _ctx: RenderContext) => TextNode({ node, ctx: _ctx }),
  });
}
