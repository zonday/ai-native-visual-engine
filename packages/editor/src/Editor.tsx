import type {
  DocumentAction,
  InteractionEngine,
  RuntimeAction,
  SelectorRegistry,
  VisualDocument,
} from "@ai-native/core";
import type {
  ComponentRegistry,
  RenderContext,
  TransformEvent,
} from "@ai-native/renderer-react";
import { useCallback, useEffect, useMemo } from "react";
import { Canvas } from "./canvas/Canvas.js";
import { useInteraction } from "./hooks/use-interaction.js";
import { Inspector } from "./panels/inspector.js";
import { Layers } from "./panels/layers.js";
import { PageList } from "./panels/page-list.js";
import { useEditorStore } from "./store.js";

export interface EditorProps {
  document: VisualDocument;
  registry: ComponentRegistry;
  context: RenderContext;
  selectorRegistry?: SelectorRegistry;
  interactionEngine?: InteractionEngine;
  onTransform?: (event: TransformEvent) => void;
  onUpdateProps?: (nodeId: string, props: Record<string, unknown>) => void;
  onViewportChange?: (vp: import("@ai-native/core").ViewportState) => void;
  onDispatchRuntime?: (action: RuntimeAction) => void;
  onDispatchDocument?: (action: DocumentAction) => void;
  canvasContainerRef?: React.Ref<HTMLDivElement>;
}

export function Editor({
  document,
  registry,
  context,
  selectorRegistry,
  interactionEngine,
  onTransform,
  onUpdateProps,
  onViewportChange,
  onDispatchRuntime,
  onDispatchDocument,
  canvasContainerRef,
}: EditorProps) {
  const activePageId = useEditorStore((s) => s.activePageId);
  const setActivePage = useEditorStore((s) => s.setActivePage);
  const { nodeIds } = useInteraction(interactionEngine);
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

  // Sync selector registry when page switches
  useEffect(() => {
    if (currentScene && selectorRegistry) {
      selectorRegistry.sync(currentScene);
    }
  }, [currentScene, selectorRegistry]);

  const editorContext: RenderContext = useMemo(
    () => ({
      ...context,
      mode: "editor",
      pageId: currentPage?.id ?? context.pageId,
      scene: currentScene ?? context.scene,
      selection: { nodeIds },
      viewport,
      interactionEngine,
    }),
    [context, currentPage, currentScene, nodeIds, viewport, interactionEngine],
  );

  const handleRenamePage = useCallback(
    (pageId: string, name: string) => {
      onDispatchDocument?.({ type: "rename-page", pageId, name });
    },
    [onDispatchDocument],
  );

  const handleRenameNode = useCallback(
    (nodeId: string, name: string) => {
      onDispatchRuntime?.({ type: "update-props", nodeId, props: { name } });
    },
    [onDispatchRuntime],
  );

  const handleReorderPage = useCallback(
    (pageId: string, index: number) => {
      onDispatchDocument?.({ type: "reorder-page", pageId, index });
    },
    [onDispatchDocument],
  );

  const handleMoveNode = useCallback(
    (nodeId: string, parentId: string, index: number) => {
      onDispatchRuntime?.({ type: "move-node", nodeId, parentId, index });
    },
    [onDispatchRuntime],
  );

  return (
    <div className="flex flex-1 min-h-0">
      <aside className="w-60 border-r border-slate-200 overflow-auto shrink-0">
        <PageList
          document={document}
          onRenamePage={handleRenamePage}
          onReorderPage={handleReorderPage}
        />
        <Layers
          selectorRegistry={selectorRegistry}
          interactionEngine={interactionEngine}
          onRenameNode={handleRenameNode}
          onMoveNode={handleMoveNode}
        />
      </aside>
      <main
        ref={canvasContainerRef}
        className="flex-1 relative overflow-hidden"
      >
        <Canvas
          registry={registry}
          context={editorContext}
          interactionEngine={interactionEngine}
          onTransform={onTransform}
          onUpdateProps={onUpdateProps}
          onViewportChange={onViewportChange}
        />
      </main>
      <aside className="w-72 border-l border-slate-200 overflow-auto shrink-0">
        <Inspector
          document={document}
          selectorRegistry={selectorRegistry}
          interactionEngine={interactionEngine}
          onDispatchRuntime={onDispatchRuntime}
        />
      </aside>
    </div>
  );
}
