import type { SceneNode } from "@ai-native/core";
import { z } from "zod";
import type { RenderContext } from "../renderer.js";
import { useNodeProps } from "../use-node-props.js";

export interface MetricTrendProps {
  node: SceneNode;
  ctx: RenderContext;
}

const metricTrendSchema = z.object({
  label: z.string().default("Trend"),
  value: z.union([z.number(), z.string()]).default(0),
  trendData: z.array(z.number()).optional(),
  trendDirection: z.string().optional(),
  changePercent: z.number().optional(),
});

const trendConfig: Record<string, { color: string; arrow: string }> = {
  up: { color: "#16a34a", arrow: "↑" },
  down: { color: "#dc2626", arrow: "↓" },
};

export function MetricTrendNode({ node }: MetricTrendProps) {
  const { label, value, trendData, trendDirection, changePercent } =
    useNodeProps(node, metricTrendSchema);

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
          {(() => {
            const max = Math.max(...trendData, 1);
            return trendData.map((v) => (
              <div
                key={`bar-${v}`}
                style={{
                  flex: 1,
                  height: `${Math.max((v / max) * 100, 4)}%`,
                  background: t.color,
                  borderRadius: "1px",
                  opacity: 0.6,
                }}
              />
            ));
          })()}
        </div>
      )}
    </div>
  );
}
