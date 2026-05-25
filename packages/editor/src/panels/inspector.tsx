import type { SceneNode, VisualDocument } from "@ai-native/core";
import { useEditorStore } from "../store.js";

export interface InspectorProps {
  document: VisualDocument;
}

export function Inspector({ document }: InspectorProps) {
  const nodeIds = useEditorStore((s) => s.nodeIds);

  const selectedId = nodeIds[0];
  if (!selectedId) {
    return (
      <div className="inspector" style={{ padding: 12 }}>
        <p style={{ fontSize: 13, color: "#94a3b8" }}>No selection</p>
      </div>
    );
  }

  // Find the selected node across all pages
  let selectedNode: SceneNode | undefined;
  for (const page of document.pages) {
    const scene = document.scenes[page.sceneId];
    if (scene) {
      const node = scene.nodes[selectedId];
      if (node) {
        selectedNode = node;
        break;
      }
    }
  }

  if (!selectedNode) {
    return (
      <div className="inspector" style={{ padding: 12 }}>
        <p style={{ fontSize: 13, color: "#94a3b8" }}>Node not found</p>
      </div>
    );
  }

  return (
    <div className="inspector" style={{ padding: 12 }}>
      <h3
        style={{
          fontSize: 12,
          fontWeight: 600,
          marginBottom: 8,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        Inspector
      </h3>
      <div style={{ fontSize: 13 }}>
        <div style={{ marginBottom: 8 }}>
          <strong>ID:</strong> {selectedNode.id}
        </div>
        <div style={{ marginBottom: 8 }}>
          <strong>Type:</strong> {selectedNode.type}
        </div>
        {selectedNode.props && (
          <div>
            <strong>Props:</strong>
            <pre style={{ fontSize: 11, marginTop: 4, whiteSpace: "pre-wrap" }}>
              {JSON.stringify(selectedNode.props, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
