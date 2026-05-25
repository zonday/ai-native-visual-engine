import type { SceneNode } from "@ai-native/core";
import type { RenderContext } from "../renderer.js";
import { useNodeProps } from "../use-node-props.js";

export interface MetricTrendNodeProps {
  node: SceneNode;
  ctx: RenderContext;
}

interface MetricTrendData {
  label?: string;
  value?: number | string;
  trendData?: number[];
  trendDirection?: string;
  changePercent?: number;
}

const trendConfig: Record<string, { color: string; arrow: string }> = {
  up: { color: "#16a34a", arrow: "↑" },
  down: { color: "#dc2626", arrow: "↓" },
};

export function MetricTrendNode({ node }: MetricTrendNodeProps) {
  const {
    label = "Trend",
    value = 0,
    trendData,
    trendDirection,
    changePercent,
  } = useNodeProps<MetricTrendData>(node);

  const t = trendConfig[trendDirection ?? ""] ?? {
    color: "#6b7280",
    arrow: "→",
  };

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
      <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem" }}>
        <span style={{ fontSize: "1.5rem", fontWeight: "700" }}>{value}</span>
        {changePercent !== undefined && (
          <span style={{ fontSize: "0.875rem", color: t.color }}>
            {`${t.arrow} ${Math.abs(changePercent)}%`}
          </span>
        )}
      </div>
      {trendData && trendData.length > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            gap: "2px",
            height: "32px",
            marginTop: "0.25rem",
          }}
        >
          {trendData.map((v) => {
            const max = Math.max(...trendData, 1);
            const h = Math.max((v / max) * 100, 4);
            return (
              <div
                key={`bar-${v}`}
                style={{
                  flex: 1,
                  height: `${h}%`,
                  background: t.color,
                  borderRadius: "1px",
                  opacity: 0.6,
                }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

export function registerMetricTrend(registry: Map<string, unknown>) {
  registry.set("metric-trend", {
    type: "metric-trend",
    render: (node: SceneNode, _ctx: RenderContext) =>
      MetricTrendNode({ node, ctx: _ctx }),
  });
}
