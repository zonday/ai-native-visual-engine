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
}

export function Canvas({ registry, context }: CanvasProps) {
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

  const handleTransform = (event: TransformEvent) => {
    void event;
    // TODO: dispatch runtime action via command bus based on event.type:
    //   "move" | "resize" → update-layout
    //   "rotate"          → rotate-node
  };

  const handleUpdateProps: SceneRendererProps["onUpdateProps"] = (
    nodeId,
    props,
  ) => {
    void nodeId;
    void props;
    // TODO: dispatch update-props runtime action via command bus
  };

  return (
    <SceneRenderer
      registry={registry}
      context={context}
      onSelectNode={handleSelectNode}
      onTransform={handleTransform}
      onUpdateProps={handleUpdateProps}
    />
  );
}
