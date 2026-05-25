import type {
  DocumentId,
  Page,
  PageId,
  PersistedSceneGraph,
  SceneId,
  VisualDocument,
} from "./types.js";

export function generateId(prefix: string): string {
  const uuid = crypto.randomUUID();
  return `${prefix}-${uuid}`;
}

export function createEmptyScene(rootId?: string): PersistedSceneGraph {
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
