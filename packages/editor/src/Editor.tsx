import type { VisualDocument } from "@ai-native/core";
import type {
  ComponentRegistry,
  RenderContext,
} from "@ai-native/renderer-react";
import { EditorCallbacksContext } from "@ai-native/renderer-react";
import { useMemo } from "react";
import { Canvas } from "./canvas/Canvas.js";
import { useEditorCallbackHandlers } from "./editor-callbacks.js";
import { Inspector } from "./panels/inspector.js";
import { Layers } from "./panels/layers.js";
import { PageList } from "./panels/page-list.js";

export interface EditorProps {
  document: VisualDocument;
  registry: ComponentRegistry;
  context: RenderContext;
}

export function Editor({ document, registry, context }: EditorProps) {
  const callbacks = useEditorCallbackHandlers();

  const editorContext: RenderContext = useMemo(
    () => ({
      ...context,
      mode: "editor",
    }),
    [context],
  );

  return (
    <EditorCallbacksContext.Provider value={callbacks}>
      <div
        className="editor-shell"
        style={{ display: "flex", height: "100vh" }}
      >
        <aside
          style={{
            width: 240,
            borderRight: "1px solid #e2e8f0",
            overflow: "auto",
          }}
        >
          <PageList document={document} />
          <Layers document={document} />
        </aside>
        <main style={{ flex: 1, position: "relative", overflow: "hidden" }}>
          <Canvas registry={registry} context={editorContext} />
        </main>
        <aside
          style={{
            width: 280,
            borderLeft: "1px solid #e2e8f0",
            overflow: "auto",
          }}
        >
          <Inspector document={document} />
        </aside>
      </div>
    </EditorCallbacksContext.Provider>
  );
}
