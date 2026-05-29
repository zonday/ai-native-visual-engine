import type {
  DocumentAction,
  HistoryState,
  RuntimeAction,
  SceneGraph,
  VisualDocument,
} from "@ai-native/core";
import {
  createHistoryState,
  createNewDocument,
  openDocumentSession,
  setCheckpoint,
} from "@ai-native/core";
import { useCallback, useEffect, useRef, useState } from "react";

function createBootstrapDoc(): VisualDocument {
  return createNewDocument({ title: "My Dashboard" });
}

export type EditorAction = RuntimeAction | DocumentAction;

export interface EditorState {
  doc: VisualDocument;
  setDoc: React.Dispatch<React.SetStateAction<VisualDocument>>;
  scene: SceneGraph;
  setScene: React.Dispatch<React.SetStateAction<SceneGraph>>;
  activePageId: string;
  historyRef: React.MutableRefObject<HistoryState<EditorAction>>;
  isUndoingRef: React.MutableRefObject<boolean>;
  canUndo: boolean;
  canRedo: boolean;
  syncHistoryState: () => void;
}

export function useEditorState(): EditorState {
  const [doc, setDoc] = useState(() => createBootstrapDoc());
  const [activePageId] = useState(() => doc.pages[0]?.id ?? "");

  const [scene, setScene] = useState<SceneGraph>(() => {
    const session = openDocumentSession(doc);
    return session.getActiveScene();
  });

  const historyRef = useRef<HistoryState<EditorAction>>(createHistoryState());
  const isUndoingRef = useRef(false);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const syncHistoryState = useCallback(() => {
    setCanUndo(historyRef.current.undoStack.length > 0);
    setCanRedo(historyRef.current.redoStack.length > 0);
  }, []);

  // Set checkpoint after initial mount to prevent undoing past initial state
  useEffect(() => {
    historyRef.current = setCheckpoint(historyRef.current);
  }, []);

  return {
    doc,
    setDoc,
    scene,
    setScene,
    activePageId,
    historyRef,
    isUndoingRef,
    canUndo,
    canRedo,
    syncHistoryState,
  };
}
