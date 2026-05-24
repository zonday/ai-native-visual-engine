import type { VisualDocument, PersistedSceneGraph, Page, DocumentId, PageId, SceneId } from "./types.js";

let idCounter = 0;

export function generateId(prefix: string): string {
  idCounter++;
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${ts}-${rand}-${idCounter}`;
}

export function createEmptyScene(
  rootId?: string,
): PersistedSceneGraph {
  const id = rootId ?? generateId("root");
  return {
    version: 0,
    rootId: id,
    nodes: {
      [id]: { id, type: "container", children: [] },
    },
  };
}

export interface NewDocumentOptions {
  title?: string;
  themeId?: string;
  route?: string;
}

export function createNewDocument(
  options?: NewDocumentOptions,
): VisualDocument {
  const docId: DocumentId = generateId("doc");
  const pageId: PageId = generateId("page");
  const sceneId: SceneId = generateId("scene");
  const scene = createEmptyScene();

  const page: Page = {
    id: pageId,
    name: options?.title ?? "Untitled",
    sceneId,
    route: options?.route,
    themeId: options?.themeId,
  };

  return {
    id: docId,
    title: options?.title ?? "Untitled",
    pages: [page],
    scenes: { [sceneId]: scene },
    activeThemeId: options?.themeId,
  };
}
