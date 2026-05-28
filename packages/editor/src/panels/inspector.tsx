import type {
  InteractionEngine,
  RuntimeAction,
  SceneNode,
  SelectorRegistry,
  VisualDocument,
} from "@ai-native/core";
import { useCallback } from "react";
import { DestructiveButton } from "../components/ui/button.js";
import { useInteraction } from "../hooks/use-interaction.js";
import { useEditorStore } from "../store.js";

export interface InspectorProps {
  document: VisualDocument;
  selectorRegistry?: SelectorRegistry;
  interactionEngine?: InteractionEngine;
  onDispatchRuntime?: (action: RuntimeAction) => void;
}

export function Inspector({
  document,
  selectorRegistry,
  interactionEngine,
  onDispatchRuntime,
}: InspectorProps) {
  const { nodeIds } = useInteraction(interactionEngine);
  const activePageId = useEditorStore((s) => s.activePageId);

  const activePage = activePageId
    ? document.pages.find((p) => p.id === activePageId)
    : undefined;

  const selectedId = nodeIds[0];

  let selectedNode: SceneNode | undefined;
  if (selectedId && activePage) {
    selectedNode = selectorRegistry?.getNode(selectedId);
  }

  const handleDelete = useCallback(() => {
    if (!selectedId || !onDispatchRuntime) return;
    onDispatchRuntime({
      type: "remove-node",
      nodeId: selectedId,
    });
    interactionEngine?.clearSelection();
  }, [selectedId, onDispatchRuntime, interactionEngine]);

  // Show page info when no node is selected
  if (!selectedId) {
    if (!activePage) {
      return (
        <div className="p-3">
          <p className="text-xs text-slate-400">No selection</p>
        </div>
      );
    }
    return (
      <div className="p-3">
        <h3 className="text-xs font-semibold mb-2 uppercase tracking-wider">
          Page
        </h3>
        <div className="text-xs space-y-2">
          <div>
            <strong>Name:</strong> {activePage.name}
          </div>
          <div>
            <strong>ID:</strong> {activePage.id}
          </div>
          <div>
            <strong>Scene:</strong> {activePage.sceneId}
          </div>
        </div>
      </div>
    );
  }

  if (!selectedNode) {
    return (
      <div className="p-3">
        <p className="text-xs text-slate-400">Node not found</p>
      </div>
    );
  }

  return (
    <div className="p-3">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider m-0">
          Inspector
        </h3>
        <DestructiveButton type="button" onClick={handleDelete}>
          Delete
        </DestructiveButton>
      </div>
      <div className="text-xs space-y-2">
        <div>
          <strong>ID:</strong> {selectedNode.id}
        </div>
        <div>
          <strong>Type:</strong> {selectedNode.type}
        </div>
        {selectedNode.props && (
          <div>
            <strong>Props:</strong>
            <pre className="text-[11px] mt-1 whitespace-pre-wrap">
              {JSON.stringify(selectedNode.props, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
