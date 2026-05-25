import type { SceneNode } from "@ai-native/core";
import { z } from "zod";
import type { RenderContext } from "../renderer.js";
import { useNodeProps } from "../use-node-props.js";

export interface FilterProps {
  node: SceneNode;
  ctx: RenderContext;
}

const filterSchema = z.object({
  filterType: z.string().default("dropdown"),
  label: z.string().default("Filter"),
  placeholder: z.string().optional(),
  options: z
    .array(z.object({ label: z.string(), value: z.string() }))
    .optional(),
});

export function FilterNode({ node }: FilterProps) {
  const { filterType, label, placeholder, options } = useNodeProps(
    node,
    filterSchema,
  );

  const inputId = `filter-${node.id}`;
  const isDateRange = filterType === "date-range";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
      <label
        htmlFor={isDateRange ? undefined : inputId}
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
            id={`${inputId}-from`}
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
            id={`${inputId}-to`}
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
