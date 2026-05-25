import type { DocNode } from "@ai-native/core";
import { useCallback } from "react";
import { useEditorStore } from "./store.js";

export interface EditorCallbackHandlers {
  onSelectNode: (nodeId: string) => void;
  onTransform: (event: {
    nodeId: string;
    x?: number;
    y?: number;
    w?: number;
    h?: number;
    rotation?: number;
  }) => void;
  onUpdateProps: (nodeId: string, props: Record<string, unknown>) => void;
  onContentChange: (nodeId: string, content: DocNode) => void;
}

export function useEditorCallbackHandlers(): EditorCallbackHandlers {
  const setSelection = useEditorStore((s) => s.setSelection);

  const onSelectNode = useCallback(
    (nodeId: string) => {
      setSelection([nodeId]);
    },
    [setSelection],
  );

  const onTransform = useCallback(
    (_event: {
      nodeId: string;
      x?: number;
      y?: number;
      w?: number;
      h?: number;
      rotation?: number;
    }) => {
      // TODO: dispatch update-layout runtime action
    },
    [],
  );

  const onUpdateProps = useCallback(
    (_nodeId: string, _props: Record<string, unknown>) => {
      // TODO: dispatch update-props runtime action
    },
    [],
  );

  const onContentChange = useCallback((_nodeId: string, _content: DocNode) => {
    // TODO: dispatch update-props for text content
  }, []);

  return { onSelectNode, onTransform, onUpdateProps, onContentChange };
}
