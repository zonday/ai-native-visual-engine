import type { SceneNode } from "@ai-native/core";
import type { RenderContext } from "../renderer.js";
import { useNodeProps } from "../use-node-props.js";

export interface MetricValueNodeProps {
  node: SceneNode;
  ctx: RenderContext;
}

interface MetricValueData {
  label?: string;
  value?: number | string;
  format?: string;
  prefix?: string;
  suffix?: string;
  color?: string;
}

export function MetricValueNode({ node }: MetricValueNodeProps) {
  const {
    label = "Metric",
    value = 0,
    prefix,
    suffix,
    color,
  } = useNodeProps<MetricValueData>(node);

  const display = `${prefix ?? ""}${String(value)}${suffix ?? ""}`;

  return (
    <div data-component="metric-value">
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
