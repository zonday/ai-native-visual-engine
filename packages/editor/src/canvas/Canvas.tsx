import type { InteractionEngine } from "@ai-native/core";
import type {
  ComponentRegistry,
  RenderContext,
  SceneRendererProps,
  TransformEvent,
} from "@ai-native/renderer-react";
import { SceneRenderer } from "@ai-native/renderer-react";

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
  const handleSelectNode: SceneRendererProps["onSelectNode"] = (
    id,
    options,
  ) => {
    if (!interactionEngine) return;
    if (options?.additive) {
      interactionEngine.toggleSelection(id);
    } else {
      interactionEngine.select([id]);
    }
  };

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
