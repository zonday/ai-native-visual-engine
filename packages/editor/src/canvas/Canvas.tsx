import type { InteractionEngine } from "@ai-native/core";
import type {
  ComponentRegistry,
  RenderContext,
  SelectNodeOptions,
  TransformEvent,
} from "@ai-native/renderer-react";
import { SceneRenderer } from "@ai-native/renderer-react";
import { useCallback } from "react";

export interface CanvasProps {
  registry: ComponentRegistry;
  context: RenderContext;
  interactionEngine?: InteractionEngine;
  onTransform?: (event: TransformEvent) => void;
  onUpdateProps?: (nodeId: string, props: Record<string, unknown>) => void;
  onViewportChange?: (vp: import("@ai-native/core").ViewportState) => void;
  selectedIds?: string[];
}

export function Canvas({
  registry,
  context,
  interactionEngine,
  onTransform,
  onUpdateProps,
  onViewportChange,
  selectedIds,
}: CanvasProps) {
  const handleSelectNode = useCallback(
    (id: string, options?: SelectNodeOptions) => {
      if (!interactionEngine) return;
      if (options?.additive) {
        interactionEngine.toggleSelection(id);
      } else {
        interactionEngine.select([id]);
      }
    },
    [interactionEngine],
  );

  return (
    <SceneRenderer
      registry={registry}
      context={context}
      selectedIds={selectedIds}
      onSelectNode={handleSelectNode}
      onTransform={onTransform}
      onUpdateProps={onUpdateProps}
      onViewportChange={onViewportChange}
    />
  );
}
