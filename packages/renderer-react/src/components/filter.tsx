import type { SceneNode } from "@ai-native/core";
import type { RenderContext } from "../renderer.js";
import { useNodeProps } from "../use-node-props.js";

export interface FilterNodeProps {
  node: SceneNode;
  ctx: RenderContext;
}

interface FilterOption {
  label: string;
  value: string;
}

interface FilterData {
  filterType?: string;
  label?: string;
  placeholder?: string;
  options?: FilterOption[];
}

export function FilterNode({ node }: FilterNodeProps) {
  const {
    filterType = "dropdown",
    label = "Filter",
    placeholder,
    options,
  } = useNodeProps<FilterData>(node);

  const inputId = `filter-${node.id}`;

  return (
    <div
      data-component="filter"
      style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}
    >
      <label
        htmlFor={inputId}
        style={{ fontSize: "0.75rem", fontWeight: "600", color: "#374151" }}
      >
        {label}
      </label>
      {filterType === "dropdown" ? (
        <select
          id={inputId}
          style={{
            padding: "0.375rem 0.5rem",
            border: "1px solid #d1d5db",
            borderRadius: "4px",
            fontSize: "0.875rem",
          }}
        >
          <option value="">{placeholder ?? "All"}</option>
          {options?.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      ) : filterType === "text" ? (
        <input
          type="text"
          id={inputId}
          placeholder={placeholder ?? "Search..."}
          style={{
            padding: "0.375rem 0.5rem",
            border: "1px solid #d1d5db",
            borderRadius: "4px",
            fontSize: "0.875rem",
          }}
        />
      ) : (
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <input
            type="date"
            style={{
              padding: "0.375rem 0.5rem",
              border: "1px solid #d1d5db",
              borderRadius: "4px",
              fontSize: "0.875rem",
            }}
          />
          <span style={{ color: "#9ca3af", alignSelf: "center" }}>—</span>
          <input
            type="date"
            style={{
              padding: "0.375rem 0.5rem",
              border: "1px solid #d1d5db",
              borderRadius: "4px",
              fontSize: "0.875rem",
            }}
          />
        </div>
      )}
    </div>
  );
}

export function registerFilter(registry: Map<string, unknown>) {
  registry.set("filter", {
    type: "filter",
    render: (node: SceneNode, _ctx: RenderContext) =>
      FilterNode({ node, ctx: _ctx }),
  });
}
