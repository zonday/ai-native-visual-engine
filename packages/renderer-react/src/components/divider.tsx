import type { SceneNode } from "@ai-native/core";
import { z } from "zod";
import type { RenderContext } from "../renderer.js";
import { useNodeProps } from "../use-node-props.js";

export interface DividerProps {
  node: SceneNode;
  ctx: RenderContext;
}

const dividerSchema = z.object({
  label: z.string().optional(),
  orientation: z.string().default("horizontal"),
  style: z.string().default("solid"),
});

export function DividerNode({ node }: DividerProps) {
  const { label, orientation, style } = useNodeProps(node, dividerSchema);
  const borderStyle = style === "dashed" ? "dashed" : "solid";

  if (orientation === "vertical") {
    return (
      <div
        style={{
          width: 0,
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
