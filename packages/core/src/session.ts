import type { VisualDocument, PersistedSceneGraph, SceneGraph, PageId } from "./types.js";

export class SessionError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "SessionError";
    this.code = code;
  }
}

export interface EditorSessionState {
  documentId: string;
  activePageId: PageId;
  isOpen: boolean;
}

export interface DocumentSession {
  readonly state: EditorSessionState;
  getDocument(): VisualDocument;
  getActiveScene(): SceneGraph;
  switchPage(pageId: PageId): void;
  close(): void;
}

export function openDocumentSession(
  document: VisualDocument,
  activePageId?: PageId,
): DocumentSession {
  if (document.pages.length === 0) {
    throw new SessionError("session.no-pages", "Cannot open document with no pages");
  }

  const pageId = activePageId ?? document.pages[0]!.id;
  const page = document.pages.find((p) => p.id === pageId);
  if (!page) {
    throw new SessionError("session.page-not-found", `Page "${pageId}" not found`);
  }

  const state: EditorSessionState = {
    documentId: document.id,
    activePageId: pageId,
    isOpen: true,
  };

  return {
    state,
    getDocument: () => document,
    getActiveScene: () => {
      if (!state.isOpen) {
        throw new SessionError("session.closed", "Session is closed");
      }
      const activePage = document.pages.find((p) => p.id === state.activePageId);
      if (!activePage) {
        throw new SessionError("session.page-not-found", `Page "${state.activePageId}" not found`);
      }
      const persistedScene = document.scenes[activePage.sceneId];
      if (!persistedScene) {
        throw new SessionError("session.scene-not-found", `Scene "${activePage.sceneId}" not found`);
      }
      return materializeScene(persistedScene);
    },
    switchPage(targetPageId: PageId): void {
      if (!state.isOpen) {
        throw new SessionError("session.closed", "Session is closed");
      }
      const target = document.pages.find((p) => p.id === targetPageId);
      if (!target) {
        throw new SessionError("session.page-not-found", `Page "${targetPageId}" not found`);
      }
      const targetScene = document.scenes[target.sceneId];
      if (!targetScene) {
        throw new SessionError("session.scene-not-found", `Scene "${target.sceneId}" not found`);
      }
      state.activePageId = targetPageId;
    },
    close(): void {
      state.isOpen = false;
    },
  };
}

export function materializeScene(
  persisted: PersistedSceneGraph,
): SceneGraph {
  return {
    version: persisted.version,
    rootId: persisted.rootId,
    nodes: { ...persisted.nodes },
    selection: undefined,
    viewport: undefined,
  };
}
