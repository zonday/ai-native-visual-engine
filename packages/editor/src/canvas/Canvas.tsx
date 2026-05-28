import type { InteractionEngine } from "@ai-native/core";
import type {
  ComponentRegistry,
  RenderContext,
  SceneRendererProps,
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
}

export function Canvas({
  registry,
  context,
  interactionEngine,
  onTransform,
  onUpdateProps,
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
      onSelectNode={handleSelectNode}
      onTransform={onTransform}
      onUpdateProps={onUpdateProps}
    />
  );
}
