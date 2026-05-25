import type { SceneNode } from "@ai-native/core";
import type { RenderContext } from "../renderer.js";
import { useNodeProps } from "../use-node-props.js";

export interface HeaderNodeProps {
  node: SceneNode;
  ctx: RenderContext;
}

interface HeaderData {
  title?: string;
  subtitle?: string;
  level?: number;
}

const headerSizes: Record<number, { title: string; subtitle: string }> = {
  1: { title: "1.5rem", subtitle: "1rem" },
  2: { title: "1.25rem", subtitle: "0.875rem" },
  3: { title: "1.125rem", subtitle: "0.75rem" },
};

export function HeaderNode({ node }: HeaderNodeProps) {
  const {
    title = "Untitled",
    subtitle,
    level = 1,
  } = useNodeProps<HeaderData>(node);

  const safeLevel = Math.min(Math.max(level, 1), 3);
  const Tag = `h${safeLevel}` as keyof HTMLElementTagNameMap;
  const size = headerSizes[safeLevel] ?? headerSizes[1];

  return (
    <div data-component="header">
      <Tag style={{ fontSize: size.title, fontWeight: "700", margin: 0 }}>
        {title}
      </Tag>
      {subtitle && (
        <p
          style={{
            fontSize: size.subtitle,
            color: "#6b7280",
            margin: "0.25rem 0 0",
          }}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}

export function registerHeader(registry: Map<string, unknown>) {
  registry.set("header", {
    type: "header",
    render: (node: SceneNode, _ctx: RenderContext) =>
      HeaderNode({ node, ctx: _ctx }),
  });
}
