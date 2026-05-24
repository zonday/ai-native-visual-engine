import { VisualDocumentSchema } from "./types.js";
import type { VisualDocument, PersistedSceneGraph, SceneGraph, PageId, DocumentSnapshot } from "./types.js";

export class SessionError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "SessionError";
    this.code = code;
  }
}

export interface ActivatePageOptions {
  pageId: PageId;
}

export interface EditorSessionState {
  documentId: string;
  activePageId: PageId;
  isOpen: boolean;
}

export interface DocumentSession {
  readonly state: EditorSessionState;

  /** Returns the current VisualDocument (read-only reference). */
  getDocument(): VisualDocument;

  /**
   * Materializes the active page's PersistedSceneGraph into a SceneGraph.
   * Returns the baseline persisted state with empty selection/viewport.
   * For runtime mutations, use a CommandBus backed by this scene.
   */
  getActiveScene(): SceneGraph;
  switchPage(pageId: PageId): void;
  close(): void;
}

export type DocumentLifecycleEvent =
  | { type: "document-opened"; snapshot: DocumentSnapshot }
  | { type: "page-activated"; pageId: PageId }
  | { type: "page-deactivated"; pageId: PageId }
  | { type: "document-saved"; snapshot: DocumentSnapshot }
  | { type: "document-closed" };

export interface DocumentLoadResult {
  ok: boolean;
  document?: VisualDocument;
  damagedPageIds?: PageId[];
  diagnostics: string[];
}

export function loadDocument(
  snapshot: DocumentSnapshot,
): DocumentLoadResult {
  const diagnostics: string[] = [];
  const damagedPageIds: PageId[] = [];
  const parsed = VisualDocumentSchema.safeParse(snapshot.document);

  if (!parsed.success) {
    return {
      ok: false,
      diagnostics: [parsed.error.message],
    };
  }

  const document = parsed.data as VisualDocument;

  for (const page of document.pages) {
    const persistedScene = document.scenes[page.sceneId];
    if (!persistedScene) {
      damagedPageIds.push(page.id);
      diagnostics.push(`Scene "${page.sceneId}" missing for page "${page.id}"`);
    }
  }

  return {
    ok: damagedPageIds.length === 0,
    document,
    damagedPageIds: damagedPageIds.length > 0 ? damagedPageIds : undefined,
    diagnostics,
  };
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

export function openDocumentFromSnapshot(
  snapshot: DocumentSnapshot,
  activePageId?: PageId,
): DocumentSession {
  const result = loadDocument(snapshot);
  if (!result.ok) {
    throw new SessionError(
      "session.load-failed",
      `Document load failed: ${result.diagnostics.join("; ")}`,
    );
  }
  return openDocumentSession(result.document!, activePageId);
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
