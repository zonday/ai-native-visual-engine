import type { SceneNode } from "@ai-native/core";
import type { RenderContext } from "../renderer.js";
import { RichTextEditor } from "./rich-text-editor.jsx";

export interface TextProps {
  node: SceneNode;
  ctx: RenderContext;
}

export function TextNode({ node, ctx }: TextProps) {
  return <RichTextEditor node={node} ctx={ctx} />;
}

export function registerText(registry: Map<string, unknown>) {
  registry.set("text", {
    type: "text",
    render: (node: SceneNode, _ctx: RenderContext) =>
      TextNode({ node, ctx: _ctx }),
  });
}
