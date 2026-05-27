import type {
  DocumentAction,
  RuntimeAction,
  SceneGraph,
  VisualDocument,
} from "@ai-native/core";
import {
  createBatchHandler,
  createConstraintMiddleware,
  createConstraintRegistry,
  createDefaultDocumentRegistries,
  createDefaultRuntimeRegistries,
  createDocumentBatchHandler,
  createDocumentCommandBus,
  createDocumentHistoryState,
  createNewDocument,
  createRuntimeCommandBus,
  createRuntimeHistoryState,
  createUndoHistoryMiddleware,
  createValidatorMiddleware,
  DEFAULT_LAYOUT_CONSTRAINTS,
  DocumentActionSchema,
  openDocumentSession,
  RuntimeActionSchema,
} from "@ai-native/core";
import type { TransformEvent } from "@ai-native/renderer-react";
import { createRendererRegistry } from "@ai-native/renderer-react";
import { useCallback, useMemo, useRef, useState } from "react";
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

  const runtimeHistoryRef = useRef(createRuntimeHistoryState());
  const documentHistoryRef = useRef(createDocumentHistoryState());

  const constraintRegistry = useMemo(() => {
    const reg = createConstraintRegistry();
    for (const c of DEFAULT_LAYOUT_CONSTRAINTS) {
      reg.register(c);
    }
    return reg;
  }, []);

  const runtimeBus = useMemo(() => {
    const { handlerRegistry } = createDefaultRuntimeRegistries(() => ({
      ok: false,
      scene,
      error: { code: "nested", message: "nested" },
    }));

    const middlewares = [
      createValidatorMiddleware<SceneGraph, RuntimeAction>(RuntimeActionSchema),
      createConstraintMiddleware(constraintRegistry),
      createUndoHistoryMiddleware(
        () => runtimeHistoryRef.current,
        (s) => {
          runtimeHistoryRef.current = s;
        },
        () => "editor",
        handlerRegistry,
        () => ({ now: Date.now, actorId: "editor" }),
      ),
    ];

    const bus = createRuntimeCommandBus(handlerRegistry, middlewares, scene, {
      now: Date.now,
      actorId: "editor",
    });

    const batchEntry = handlerRegistry.get("batch-actions");
    if (batchEntry) {
      handlerRegistry.set("batch-actions", {
        ...batchEntry,
        handler: createBatchHandler((action) =>
          bus.dispatch(action),
        ) as typeof batchEntry.handler,
      });
    }

    return bus;
  }, [scene, constraintRegistry]);

  const documentBus = useMemo(() => {
    const { handlerRegistry } = createDefaultDocumentRegistries(() => ({
      ok: false,
      document: doc,
      error: { code: "nested", message: "nested" },
    }));

    const middlewares = [
      createValidatorMiddleware<VisualDocument, DocumentAction>(
        DocumentActionSchema,
      ),
      createUndoHistoryMiddleware(
        () => documentHistoryRef.current,
        (s) => {
          documentHistoryRef.current = s;
        },
        () => "editor",
        handlerRegistry,
        () => ({ now: Date.now, actorId: "editor" }),
      ),
    ];

    const bus = createDocumentCommandBus(handlerRegistry, middlewares, doc, {
      now: Date.now,
      actorId: "editor",
    });

    const batchDocEntry = handlerRegistry.get("batch-document-actions");
    if (batchDocEntry) {
      handlerRegistry.set("batch-document-actions", {
        ...batchDocEntry,
        handler: createDocumentBatchHandler((action) =>
          bus.dispatch(action),
        ) as typeof batchDocEntry.handler,
      });
    }

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
            x: ((layout.x as number) ?? 0) + event.deltaX,
            y: ((layout.y as number) ?? 0) + event.deltaY,
          },
        });
      } else if (event.type === "resize") {
        dispatchRuntime({
          type: "update-layout",
          nodeId: event.nodeId,
          layout: {
            width: ((layout.width as number) ?? 100) + event.deltaX,
            height: ((layout.height as number) ?? 100) + event.deltaY,
          },
        });
      } else if (event.type === "rotate") {
        const rotation = ((layout.rotation as number) ?? 0) + event.deltaX;
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
