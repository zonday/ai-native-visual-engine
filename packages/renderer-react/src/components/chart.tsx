import type { SceneNode } from "@ai-native/core";
import type { RenderContext } from "../renderer.js";
import { useNodeProps } from "../use-node-props.js";

export interface ChartNodeProps {
  node: SceneNode;
  ctx: RenderContext;
}

interface ChartData {
  chartType?: string;
  title?: string;
  height?: number;
}

export function ChartNode({ node }: ChartNodeProps) {
  const {
    chartType = "bar",
    title,
    height = 200,
  } = useNodeProps<ChartData>(node);

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

export function registerChart(registry: Map<string, unknown>) {
  registry.set("chart", {
    type: "chart",
    render: (node: SceneNode, _ctx: RenderContext) =>
      ChartNode({ node, ctx: _ctx }),
  });
}
