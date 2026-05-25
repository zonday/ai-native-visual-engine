import type { DocNode } from "@ai-native/core";
import { createContext, useContext } from "react";

export interface EditorCallbacks {
  onUpdateProps?: (nodeId: string, props: Record<string, unknown>) => void;
  onContentChange?: (nodeId: string, content: DocNode) => void;
}

export const EditorCallbacksContext = createContext<EditorCallbacks>({});

export function useEditorCallbacks(): EditorCallbacks {
  return useContext(EditorCallbacksContext);
}
