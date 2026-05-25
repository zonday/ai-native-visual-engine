import type { SceneNode } from "@ai-native/core";
import { z } from "zod";
import type { RenderContext } from "../renderer.js";
import { useNodeProps } from "../use-node-props.js";

export interface MetricComparisonProps {
  node: SceneNode;
  ctx: RenderContext;
}

const metricComparisonSchema = z.object({
  label: z.string().default("Comparison"),
  value: z.union([z.number(), z.string()]).default(0),
  compareValue: z.union([z.number(), z.string()]).optional(),
  compareLabel: z.string().optional(),
  changePercent: z.number().optional(),
});

export function MetricComparisonNode({ node }: MetricComparisonProps) {
  const { label, value, compareValue, compareLabel, changePercent } =
    useNodeProps(node, metricComparisonSchema);

  const pct = changePercent ?? 0;
  const isPositive = pct >= 0;
  const pctColor = isPositive ? "#16a34a" : "#dc2626";

  return (
    <div>
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
