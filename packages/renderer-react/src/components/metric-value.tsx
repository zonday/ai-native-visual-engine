import type { SceneNode } from "@ai-native/core";
import { z } from "zod";
import type { RenderContext } from "../renderer.js";
import { useNodeProps } from "../use-node-props.js";

export interface MetricValueProps {
  node: SceneNode;
  ctx: RenderContext;
}

const metricValueSchema = z.object({
  label: z.string().default("Metric"),
  value: z.union([z.number(), z.string()]).default(0),
  prefix: z.string().optional(),
  suffix: z.string().optional(),
  color: z.string().optional(),
});

export function MetricValueNode({ node }: MetricValueProps) {
  const { label, value, prefix, suffix, color } = useNodeProps(
    node,
    metricValueSchema,
  );

  const display = `${prefix ?? ""}${String(value)}${suffix ?? ""}`;

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
      <div
        style={{
          fontSize: "1.5rem",
          fontWeight: "700",
          color: color ?? "inherit",
        }}
      >
        {display}
      </div>
    </div>
  );
}

export function registerMetricValue(registry: Map<string, unknown>) {
  registry.set("metric-value", {
    type: "metric-value",
    render: (node: SceneNode, _ctx: RenderContext) =>
      MetricValueNode({ node, ctx: _ctx }),
  });
}
