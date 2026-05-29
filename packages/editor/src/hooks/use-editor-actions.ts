import type {
  DocumentAction,
  HistoryState,
  RuntimeAction,
  SceneGraph,
  VisualDocument,
} from "@ai-native/core";
import { redoAction, undoAction } from "@ai-native/core";
import type { TransformEvent } from "@ai-native/renderer-react";
import React, { useCallback, useEffect } from "react";
import type { EditorEngines } from "./use-editor-engines.js";
import type { EditorAction } from "./use-editor-state.js";

export interface EditorActions {
  dispatchRuntime: (action: RuntimeAction) => void;
  addPage: () => void;
  addNode: (type: string, layout?: Record<string, unknown>) => void;
  handleTransform: (event: TransformEvent) => void;
  handleUpdateProps: (nodeId: string, props: Record<string, unknown>) => void;
  handleUndo: () => void;
  handleRedo: () => void;
  handleDelete: () => void;
  handleMoveSelectedNode: (direction: "up" | "down") => void;
  handleDispatchDocument: (action: DocumentAction) => void;
  showDebug: boolean;
  setShowDebug: React.Dispatch<React.SetStateAction<boolean>>;
}

export function useEditorActions(
  engines: EditorEngines,
  scene: SceneGraph,
  activePageId: string,
  _doc: VisualDocument,
  setDoc: React.Dispatch<React.SetStateAction<VisualDocument>>,
  setScene: React.Dispatch<React.SetStateAction<SceneGraph>>,
  historyRef: React.MutableRefObject<HistoryState<EditorAction>>,
  isUndoingRef: React.MutableRefObject<boolean>,
  syncHistoryState: () => void,
): EditorActions {
  const { selectorRegistry, interactionEngine, runtimeBus, documentBus } =
    engines;
  const [showDebug, setShowDebug] = React.useState(false);

  // Wire interaction engine into scheduler — clear stale selections after compute
  useEffect(() => {
    const s = engines.schedulerRef.current;
    return s.subscribe({
      onAfterCompute: () => {
        const selected = interactionEngine.getSelection();
        const valid = selected.filter((id) => selectorRegistry.getNode(id));
        if (valid.length !== selected.length) {
          interactionEngine.select(valid);
        }
      },
    });
  }, [interactionEngine, selectorRegistry, engines.schedulerRef]);

  const dispatchRuntime = useCallback(
    (action: RuntimeAction) => {
      const result = runtimeBus.dispatch(action);
      if (result.ok) {
        setScene(result.scene);
        setDoc((currentDoc) => {
          const currentPage = currentDoc.pages.find(
            (page) => page.id === activePageId,
          );
          if (!currentPage) return currentDoc;
          return {
            ...currentDoc,
            scenes: {
              ...currentDoc.scenes,
              [currentPage.sceneId]: {
                version: result.scene.version,
                rootId: result.scene.rootId,
                nodes: result.scene.nodes,
                metadata: result.scene.metadata,
              },
            },
          };
        });
      }
    },
    [activePageId, runtimeBus, setScene, setDoc],
  );

  const addPage = useCallback(() => {
    const sceneId = `scene-${Date.now()}`;
    const p = {
      type: "create-page" as const,
      page: { id: `p-${Date.now()}`, name: "New Page", sceneId },
      scene: {
        version: 0,
        rootId: "r",
        nodes: { r: { id: "r", type: "container", children: [] } },
      },
    };
    const result = documentBus.dispatch(p);
    if (result.ok) setDoc(result.document);
  }, [documentBus, setDoc]);

  const addNode = useCallback(
    (type: string, layout?: Record<string, unknown>) => {
      const id = `n-${Date.now()}`;
      dispatchRuntime({
        type: "create-node",
        node: { id, type, layout },
        parentId: scene.rootId,
      });
    },
    [dispatchRuntime, scene.rootId],
  );

  const handleTransform = useCallback(
    (event: TransformEvent) => {
      const el = document.querySelector(
        `[data-node-id="${event.nodeId}"]`,
      ) as HTMLElement | null;

      if (!event.commit) {
        if (!el) return;
        if (event.type === "move") {
          el.style.transform = `translate(${event.deltaX}px, ${event.deltaY}px)`;
        } else if (event.type === "resize") {
          const node = selectorRegistry.getNode(event.nodeId);
          const layout = (node?.layout ?? {}) as Record<string, unknown>;
          el.style.width = `${Math.max(10, (Number(layout.width) || 100) + event.deltaX)}px`;
          el.style.height = `${Math.max(10, (Number(layout.height) || 100) + event.deltaY)}px`;
        }
        return;
      }

      // Reset visual transform
      if (el) {
        el.style.transform = "";
        el.style.width = "";
        el.style.height = "";
      }

      const node = selectorRegistry.getNode(event.nodeId);
      if (!node) return;
      const layout = (node.layout ?? {}) as Record<string, unknown>;

      if (event.type === "move") {
        dispatchRuntime({
          type: "update-layout",
          nodeId: event.nodeId,
          layout: {
            x: (Number(layout.x) || 0) + event.deltaX,
            y: (Number(layout.y) || 0) + event.deltaY,
          },
        });
      } else if (event.type === "resize") {
        dispatchRuntime({
          type: "update-layout",
          nodeId: event.nodeId,
          layout: {
            width: (Number(layout.width) || 100) + event.deltaX,
            height: (Number(layout.height) || 100) + event.deltaY,
          },
        });
      } else if (event.type === "rotate") {
        const rotation = (Number(layout.rotation) || 0) + event.deltaX;
        dispatchRuntime({
          type: "rotate-node",
          nodeId: event.nodeId,
          rotation,
        });
      }
    },
    [dispatchRuntime, selectorRegistry],
  );

  const handleUpdateProps = useCallback(
    (nodeId: string, props: Record<string, unknown>) => {
      dispatchRuntime({ type: "update-props", nodeId, props });
    },
    [dispatchRuntime],
  );

  const handleUndo = useCallback(() => {
    const result = undoAction(historyRef.current);
    if (!result) return;
    isUndoingRef.current = true;
    const entry: RuntimeAction | DocumentAction = result.inverseActions[0] as
      | RuntimeAction
      | DocumentAction;
    const isRuntime = "nodeId" in entry || "activeStates" in entry;
    const dispatchResult = isRuntime
      ? runtimeBus.dispatch(entry as RuntimeAction)
      : documentBus.dispatch(entry as DocumentAction);
    isUndoingRef.current = false;
    if (dispatchResult.ok) {
      historyRef.current = result.state;
      syncHistoryState();
      if ("scene" in dispatchResult) {
        setScene(dispatchResult.scene);
        setDoc((d) => {
          const page = d.pages.find((p) => p.id === activePageId);
          if (!page) return d;
          return {
            ...d,
            scenes: {
              ...d.scenes,
              [page.sceneId]: {
                ...dispatchResult.scene,
              },
            },
          };
        });
      } else {
        setDoc(dispatchResult.document);
      }
    }
  }, [
    runtimeBus,
    documentBus,
    activePageId,
    syncHistoryState,
    historyRef,
    isUndoingRef,
    setScene,
    setDoc,
  ]);

  const handleRedo = useCallback(() => {
    const result = redoAction(historyRef.current);
    if (!result) return;
    isUndoingRef.current = true;
    const entry: RuntimeAction | DocumentAction = result.actions[0] as
      | RuntimeAction
      | DocumentAction;
    const isRuntime = "nodeId" in entry || "activeStates" in entry;
    const dispatchResult = isRuntime
      ? runtimeBus.dispatch(entry as RuntimeAction)
      : documentBus.dispatch(entry as DocumentAction);
    isUndoingRef.current = false;
    if (dispatchResult.ok) {
      historyRef.current = result.state;
      syncHistoryState();
      if ("scene" in dispatchResult) {
        setScene(dispatchResult.scene);
        setDoc((d) => {
          const page = d.pages.find((p) => p.id === activePageId);
          if (!page) return d;
          return {
            ...d,
            scenes: {
              ...d.scenes,
              [page.sceneId]: {
                ...dispatchResult.scene,
              },
            },
          };
        });
      } else {
        setDoc(dispatchResult.document);
      }
    }
  }, [
    runtimeBus,
    documentBus,
    activePageId,
    syncHistoryState,
    historyRef,
    isUndoingRef,
    setScene,
    setDoc,
  ]);

  const handleDelete = useCallback(() => {
    const selected = interactionEngine.getSelection();
    const rootId = scene.rootId;
    for (const nodeId of selected) {
      if (nodeId === rootId) continue;
      dispatchRuntime({ type: "remove-node", nodeId });
    }
  }, [interactionEngine, scene.rootId, dispatchRuntime]);

  const handleMoveSelectedNode = useCallback(
    (direction: "up" | "down") => {
      const selection = interactionEngine.getSelection();
      const nodeId = selection[0];
      if (selection.length !== 1 || !nodeId) return;
      if (nodeId === scene.rootId) return;
      const parent = selectorRegistry.getParent(nodeId);
      if (!parent) return;
      const siblings = selectorRegistry.getChildren(parent.id);
      const idx = siblings.findIndex((s) => s.id === nodeId);
      if (idx === -1) return;
      const newIndex =
        direction === "up"
          ? Math.max(0, idx - 1)
          : Math.min(siblings.length - 1, idx + 1);
      if (newIndex === idx) return;
      dispatchRuntime({
        type: "move-node",
        nodeId,
        parentId: parent.id,
        index: newIndex,
      });
    },
    [interactionEngine, scene.rootId, selectorRegistry, dispatchRuntime],
  );

  const handleDispatchDocument = useCallback(
    (action: DocumentAction) => {
      const result = documentBus.dispatch(action);
      if (result.ok) setDoc(result.document);
    },
    [documentBus, setDoc],
  );

  return {
    dispatchRuntime,
    addPage,
    addNode,
    handleTransform,
    handleUpdateProps,
    handleUndo,
    handleRedo,
    handleDelete,
    handleMoveSelectedNode,
    handleDispatchDocument,
    showDebug,
    setShowDebug,
  };
}
