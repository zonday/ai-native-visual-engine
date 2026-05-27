import type {
  RuntimeAction,
  SceneGraph,
  VisualDocument,
} from "@ai-native/core";
import {
  createBatchHandler,
  createDefaultDocumentRegistries,
  createDefaultRuntimeRegistries,
  createDocumentBatchHandler,
  createDocumentCommandBus,
  createNewDocument,
  createRuntimeCommandBus,
  openDocumentSession,
} from "@ai-native/core";
import type { TransformEvent } from "@ai-native/renderer-react";
import { createRendererRegistry } from "@ai-native/renderer-react";
import { useCallback, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { Editor } from "./Editor.js";

function createBootstrapDoc(): VisualDocument {
  return createNewDocument({ title: "My Dashboard" });
}

function App() {
  const [doc, setDoc] = useState(() => createBootstrapDoc());
  const [activePageId] = useState(() => doc.pages[0]?.id ?? "");

  const [scene, setScene] = useState<SceneGraph>(() => {
    const session = openDocumentSession(doc);
    return session.getActiveScene();
  });

  const runtimeBus = useMemo(() => {
    const { handlerRegistry } = createDefaultRuntimeRegistries(() => ({
      ok: false,
      scene,
      error: { code: "nested", message: "nested" },
    }));
    const bus = createRuntimeCommandBus(handlerRegistry, [], scene, {
      now: Date.now,
      actorId: "editor",
    });

    handlerRegistry.set("batch-actions", {
      handler: createBatchHandler((action) => bus.dispatch(action)),
      inverse: handlerRegistry.get("batch-actions")?.inverse,
    });

    return bus;
  }, [scene]);

  const documentBus = useMemo(() => {
    const { handlerRegistry } = createDefaultDocumentRegistries(() => ({
      ok: false,
      document: doc,
      error: { code: "nested", message: "nested" },
    }));
    const bus = createDocumentCommandBus(handlerRegistry, [], doc, {
      now: Date.now,
      actorId: "editor",
    });

    handlerRegistry.set("batch-document-actions", {
      handler: createDocumentBatchHandler((action) => bus.dispatch(action)),
      inverse: handlerRegistry.get("batch-document-actions")?.inverse,
    });

    return bus;
  }, [doc]);

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
    [activePageId, runtimeBus],
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
  }, [documentBus]);

  const addNode = useCallback(() => {
    const id = `n-${Date.now()}`;
    dispatchRuntime({
      type: "create-node",
      node: { id, type: "text" },
      parentId: scene.rootId,
    });
  }, [dispatchRuntime, scene.rootId]);

  const handleTransform = useCallback(
    (event: TransformEvent) => {
      if (!event.commit) return;

      const node = scene.nodes[event.nodeId];
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
    [dispatchRuntime, scene.nodes],
  );

  const handleUpdateProps = useCallback(
    (nodeId: string, props: Record<string, unknown>) => {
      dispatchRuntime({ type: "update-props", nodeId, props });
    },
    [dispatchRuntime],
  );

  const registry = useMemo(() => createRendererRegistry(), []);

  const firstPageSceneId =
    doc.pages.find((p) => p.id === activePageId)?.sceneId ?? "";
  const currentScene = firstPageSceneId
    ? (doc.scenes[firstPageSceneId] ?? scene)
    : scene;

  return (
    <div>
      <div
        style={{ padding: 8, background: "#f0f0f0", display: "flex", gap: 8 }}
      >
        <button type="button" onClick={addPage}>
          + Add Page
        </button>
        <button type="button" onClick={addNode}>
          + Add Text Node
        </button>
        <span style={{ marginLeft: "auto" }}>
          Pages: {doc.pages.length} | Nodes: {Object.keys(scene.nodes).length}
        </span>
      </div>
      <Editor
        document={doc}
        registry={registry}
        context={{ pageId: activePageId, mode: "editor", scene: currentScene }}
        onTransform={handleTransform}
        onUpdateProps={handleUpdateProps}
      />
    </div>
  );
}

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element not found");
}

const root = createRoot(rootElement);
root.render(<App />);
