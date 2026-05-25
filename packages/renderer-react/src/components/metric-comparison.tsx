import type { SceneNode } from "@ai-native/core";
import type { RenderContext } from "../renderer.js";
import { useNodeProps } from "../use-node-props.js";

export interface MetricComparisonNodeProps {
  node: SceneNode;
  ctx: RenderContext;
}

interface MetricComparisonData {
  label?: string;
  value?: number | string;
  compareValue?: number | string;
  compareLabel?: string;
  changePercent?: number;
}

export function MetricComparisonNode({ node }: MetricComparisonNodeProps) {
  const {
    label = "Comparison",
    value = 0,
    compareValue,
    compareLabel,
    changePercent,
  } = useNodeProps<MetricComparisonData>(node);

  const pct = changePercent ?? 0;
  const isPositive = pct >= 0;
  const pctColor = isPositive ? "#16a34a" : "#dc2626";

  return (
    <div data-component="metric-comparison">
      <div
        style={{
          fontSize: "0.75rem",
          color: "#6b7280",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        {label}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: "0.75rem" }}>
        <span style={{ fontSize: "1.5rem", fontWeight: "700" }}>{value}</span>
        {compareValue !== undefined && (
          <span style={{ fontSize: "0.875rem", color: "#9ca3af" }}>
            vs {String(compareValue)}
            {compareLabel && ` (${compareLabel})`}
          </span>
        )}
        {changePercent !== undefined && (
          <span style={{ fontSize: "0.875rem", color: pctColor }}>
            {`${isPositive ? "↑" : "↓"} ${Math.abs(pct)}%`}
          </span>
        )}
      </div>
    </div>
  );
}

export function registerMetricComparison(registry: Map<string, unknown>) {
  registry.set("metric-comparison", {
    type: "metric-comparison",
    render: (node: SceneNode, _ctx: RenderContext) =>
      MetricComparisonNode({ node, ctx: _ctx }),
  });
}
