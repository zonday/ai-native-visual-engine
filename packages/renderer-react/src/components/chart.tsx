import type { SceneNode } from "@ai-native/core";
import { z } from "zod";
import type { RenderContext } from "../renderer.js";
import { useNodeProps } from "../use-node-props.js";

export interface ChartProps {
  node: SceneNode;
  ctx: RenderContext;
}

const chartSchema = z.object({
  chartType: z.string().default("bar"),
  title: z.string().optional(),
  height: z.number().default(300),
});

export function ChartNode({ node }: ChartProps) {
  const { chartType, title, height } = useNodeProps(node, chartSchema);

  return (
    <div style={{ height }}>
      {title && (
        <div
          style={{
            fontSize: "0.875rem",
            fontWeight: "600",
            marginBottom: "0.5rem",
          }}
        >
          {title}
        </div>
      )}
      <div
        style={{
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f3f4f6",
          borderRadius: "4px",
          color: "#9ca3af",
          fontSize: "0.75rem",
        }}
      >
        {`[${chartType} chart]`}
      </div>
    </div>
  );
}
