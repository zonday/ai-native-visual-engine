import type {
  ComponentRegistry,
  RenderContext,
  SceneRendererProps,
} from "@ai-native/renderer-react";
import { SceneRenderer } from "@ai-native/renderer-react";
import { useEditorStore } from "../store.js";

export interface CanvasProps {
  registry: ComponentRegistry;
  context: RenderContext;
}

export function Canvas({ registry, context }: CanvasProps) {
  const nodeIds = useEditorStore((s) => s.nodeIds);
  const viewport = useEditorStore((s) => s.viewport);

  const editorContext: RenderContext = {
    ...context,
    mode: "editor",
    selection: { nodeIds },
    viewport,
  };

  const handleSelectNode: SceneRendererProps["onSelectNode"] = (id) => {
    useEditorStore.getState().setSelection([id]);
  };

  const handleTransform: SceneRendererProps["onTransform"] = (event) => {
    // TODO: dispatch update-layout runtime action via command bus
    void event;
  };

  const handleUpdateProps: SceneRendererProps["onUpdateProps"] = (
    nodeId,
    props,
  ) => {
    // TODO: dispatch update-props runtime action via command bus
    void nodeId;
    void props;
  };

  return (
    <SceneRenderer
      registry={registry}
      context={editorContext}
      onSelectNode={handleSelectNode}
      onTransform={handleTransform}
      onUpdateProps={handleUpdateProps}
    />
  );
}
