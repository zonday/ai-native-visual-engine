export interface MissingPluginPlaceholderProps {
  nodeType: string;
  mode: "editor" | "runtime";
}

export function MissingPluginPlaceholder({
  nodeType,
  mode,
}: MissingPluginPlaceholderProps) {
  return (
    <div
      data-component="missing-plugin"
      style={{
        border: "2px dashed #f59e0b",
        padding: "1rem",
        borderRadius: "0.25rem",
        minWidth: "80px",
        minHeight: "40px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: mode === "editor" ? "#fffbeb" : "#fef3c7",
      }}
    >
      <span style={{ color: "#d97706", fontSize: "0.75rem" }}>
        Unknown: {nodeType}
      </span>
    </div>
  );
}
