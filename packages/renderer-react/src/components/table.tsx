import type { SceneNode } from "@ai-native/core";
import type { RenderContext } from "../renderer.js";
import { useNodeProps } from "../use-node-props.js";

export interface TableNodeProps {
  node: SceneNode;
  ctx: RenderContext;
}

interface TableColumn {
  key: string;
  label: string;
}

interface TableData {
  columns?: TableColumn[];
}

export function TableNode({ node }: TableNodeProps) {
  const { columns } = useNodeProps<TableData>(node);

  return (
    <div style={{ overflow: "auto", fontSize: "0.875rem" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {columns?.map((col) => (
              <th
                key={col.key}
                style={{
                  padding: "0.5rem",
                  textAlign: "left",
                  borderBottom: "2px solid #e5e7eb",
                  fontWeight: "600",
                  color: "#374151",
                }}
              >
                {col.label}
              </th>
            )) ?? (
              <th
                style={{
                  padding: "0.5rem",
                  borderBottom: "2px solid #e5e7eb",
                  color: "#9ca3af",
                }}
              >
                No columns configured
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td
              colSpan={columns?.length ?? 1}
              style={{ padding: "1rem", textAlign: "center", color: "#9ca3af" }}
            >
              [data rows bound from variable]
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export function registerTable(registry: Map<string, unknown>) {
  registry.set("table", {
    type: "table",
    render: (node: SceneNode, _ctx: RenderContext) =>
      TableNode({ node, ctx: _ctx }),
  });
}
