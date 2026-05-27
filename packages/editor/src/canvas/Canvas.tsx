import type {
  ComponentRegistry,
  RenderContext,
  SceneRendererProps,
  TransformEvent,
} from "@ai-native/renderer-react";
import { SceneRenderer } from "@ai-native/renderer-react";
import { useEditorStore } from "../store.js";

export interface CanvasProps {
  registry: ComponentRegistry;
  context: RenderContext;
  onTransform?: (event: TransformEvent) => void;
  onUpdateProps?: (nodeId: string, props: Record<string, unknown>) => void;
}

export function Canvas({
  registry,
  context,
  onTransform,
  onUpdateProps,
}: CanvasProps) {
  const handleSelectNode: SceneRendererProps["onSelectNode"] = (
    id,
    options,
  ) => {
    if (options?.additive) {
      const s = useEditorStore.getState();
      if (s.nodeIds.includes(id)) {
        s.removeFromSelection(id);
      } else {
        s.addToSelection(id);
      }
    } else {
      useEditorStore.getState().setSelection([id]);
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
