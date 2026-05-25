import type { SceneNode } from "@ai-native/core";
import type { RenderContext } from "../renderer.js";
import { useNodeProps } from "../use-node-props.js";

export interface DividerNodeProps {
  node: SceneNode;
  ctx: RenderContext;
}

interface DividerData {
  label?: string;
  orientation?: string;
  style?: string;
}

export function DividerNode({ node }: DividerNodeProps) {
  const {
    label,
    orientation = "horizontal",
    style = "solid",
  } = useNodeProps<DividerData>(node);

  const borderStyle = style === "dashed" ? "dashed" : "solid";

  if (orientation === "vertical") {
    return (
      <div
        style={{
          width: "1px",
          minHeight: "24px",
          borderLeft: `1px ${borderStyle} #e5e7eb`,
          alignSelf: "stretch",
        }}
      />
    );
  }

  if (label) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          color: "#9ca3af",
          fontSize: "0.75rem",
        }}
      >
        <div style={{ flex: 1, borderTop: `1px ${borderStyle} #e5e7eb` }} />
        <span>{label}</span>
        <div style={{ flex: 1, borderTop: `1px ${borderStyle} #e5e7eb` }} />
      </div>
    );
  }

  return <div style={{ borderTop: `1px ${borderStyle} #e5e7eb` }} />;
}

export function registerDivider(registry: Map<string, unknown>) {
  registry.set("divider", {
    type: "divider",
    render: (node: SceneNode, _ctx: RenderContext) =>
      DividerNode({ node, ctx: _ctx }),
  });
}
