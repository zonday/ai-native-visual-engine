import type { VisualDocument } from "@ai-native/core";
import type {
  ComponentRegistry,
  RenderContext,
  TransformEvent,
} from "@ai-native/renderer-react";
import { useEffect, useMemo } from "react";
import { Canvas } from "./canvas/Canvas.js";
import { Inspector } from "./panels/inspector.js";
import { Layers } from "./panels/layers.js";
import { PageList } from "./panels/page-list.js";
import { useEditorStore } from "./store.js";

export interface EditorProps {
  document: VisualDocument;
  registry: ComponentRegistry;
  context: RenderContext;
  onTransform?: (event: TransformEvent) => void;
  onUpdateProps?: (nodeId: string, props: Record<string, unknown>) => void;
}

export function Editor({
  document,
  registry,
  context,
  onTransform,
  onUpdateProps,
}: EditorProps) {
  const activePageId = useEditorStore((s) => s.activePageId);
  const setActivePage = useEditorStore((s) => s.setActivePage);
  const nodeIds = useEditorStore((s) => s.nodeIds);
  const viewport = useEditorStore((s) => s.viewport);

  useEffect(() => {
    if (activePageId === null && context.pageId) {
      setActivePage(context.pageId);
    }
  }, [activePageId, context.pageId, setActivePage]);

  const resolvedPageId = activePageId ?? context.pageId;
  const currentPage = document.pages.find((p) => p.id === resolvedPageId);
  const currentScene = currentPage
    ? document.scenes[currentPage.sceneId]
    : context.scene;

  const editorContext: RenderContext = useMemo(
    () => ({
      ...context,
      mode: "editor",
      pageId: currentPage?.id ?? context.pageId,
      scene: currentScene ?? context.scene,
      selection: { nodeIds },
      viewport,
    }),
    [context, currentPage, currentScene, nodeIds, viewport],
  );

  return (
    <div className="editor-shell" style={{ display: "flex", height: "100vh" }}>
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
        <Canvas
          registry={registry}
          context={editorContext}
          onTransform={onTransform}
          onUpdateProps={onUpdateProps}
        />
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
  );
}
