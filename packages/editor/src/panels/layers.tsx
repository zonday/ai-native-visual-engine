import type { VisualDocument } from "@ai-native/core";
import { useEditorStore } from "../store.js";

export interface LayersProps {
  document: VisualDocument;
}

export function Layers({ document }: LayersProps) {
  const activePageId = useEditorStore((s) => s.activePageId);
  const activePage = activePageId
    ? document.pages.find((p) => p.id === activePageId)
    : undefined;

  if (!activePage) return null;

  const scene = document.scenes[activePage.sceneId];
  const nodes = scene ? Object.values(scene.nodes) : [];

  return (
    <div
      className="layers"
      style={{ padding: 12, borderTop: "1px solid #e2e8f0" }}
    >
      <h3
        style={{
          fontSize: 12,
          fontWeight: 600,
          marginBottom: 8,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        Layers
      </h3>
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {nodes.map((node) => (
          <li key={node.id} style={{ marginBottom: 4 }}>
            <span
              style={{
                display: "block",
                padding: "4px 8px",
                borderRadius: 4,
                fontSize: 13,
                cursor: "default",
              }}
            >
              {node.type}:{node.id.slice(0, 8)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
