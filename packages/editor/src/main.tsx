import { useCallback, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import type {
  ComponentPlugin,
  DocumentAction,
  RuntimeAction,
  SceneGraph,
  VisualDocument,
} from "@ai-native/core";
import { createNewDocument, openDocumentSession, createRuntimeCommandBus, createDocumentCommandBus, createDefaultRuntimeRegistries, createDefaultDocumentRegistries, materializeScene } from "@ai-native/core";
import { type ComponentRegistry, createRendererRegistry } from "@ai-native/renderer-react";
import { Editor } from "./Editor.js";

function createBootstrapDoc(): VisualDocument {
  return createNewDocument({ title: "My Dashboard" });
}

function App() {
  const [doc, setDoc] = useState(() => createBootstrapDoc());
  const [activePageId] = useState(() => doc.pages[0]?.id ?? "");

  const [scene, setScene] = useState<SceneGraph>(() => {
    const session = openDocumentSession(doc);
    return materializeScene(session.state.scene);
  });

  const [nodeCounter, setNodeCounter] = useState(0);

  const runtimeBus = useMemo(() => {
    const { handlerRegistry } = createDefaultRuntimeRegistries(() => ({
      ok: false,
      scene,
      error: { code: "nested", message: "nested" },
    }));
    return createRuntimeCommandBus(handlerRegistry, [], scene, {
      now: Date.now,
      actorId: "editor",
    });
  }, []);

  const documentBus = useMemo(() => {
    const { handlerRegistry } = createDefaultDocumentRegistries(() => ({
      ok: false,
      document: doc,
      error: { code: "nested", message: "nested" },
    }));
    return createDocumentCommandBus(handlerRegistry, [], doc, {
      now: Date.now,
      actorId: "editor",
    });
  }, []);

  const dispatchRuntime = useCallback(
    (action: RuntimeAction) => {
      const result = runtimeBus.dispatch(action);
      if (result.ok) setScene(result.scene);
    },
    [runtimeBus],
  );

  const addPage = useCallback(() => {
    const sceneId = `scene-${Date.now()}`;
    const p = {
      type: "create-page" as const,
      page: { id: `p-${Date.now()}`, name: "New Page", sceneId },
      scene: { version: 0, rootId: "r", nodes: { r: { id: "r", type: "container", children: [] } } },
    };
    const result = documentBus.dispatch(p);
    if (result.ok) setDoc(result.document);
  }, [documentBus]);

  const addNode = useCallback(() => {
    const id = `n-${Date.now()}`;
    dispatchRuntime({
      type: "create-node",
      node: { id, type: "text" },
      parentId: "root",
    });
  }, [dispatchRuntime]);

  const plugins: ComponentPlugin[] = [
    { type: "container", name: "Container", description: "Layout container", defaultProps: {}, defaultLayout: { mode: "free" }, render: () => ({ type: "react", element: "div" }) },
    { type: "text", name: "Text", description: "Text block", defaultProps: {}, defaultLayout: { mode: "free" }, render: () => ({ type: "react", element: "span" }) },
    { type: "grid", name: "Grid", description: "Grid layout", defaultProps: {}, defaultLayout: { mode: "grid", columns: 12 }, render: () => ({ type: "react", element: "div" }) },
    { type: "metric-value", name: "Metric Value", description: "KPI", defaultProps: {}, defaultLayout: { mode: "grid-item", w: 4, h: 3 }, render: () => ({ type: "react", element: "div" }) },
    { type: "chart", name: "Chart", description: "Chart", defaultProps: {}, defaultLayout: { mode: "grid-item", w: 8, h: 4 }, render: () => ({ type: "react", element: "div" }) },
    { type: "header", name: "Header", description: "Header", defaultProps: {}, defaultLayout: { mode: "grid-item", w: 12, h: 1 }, render: () => ({ type: "react", element: "h2" }) },
  ];

  const registry = createRendererRegistry(plugins);

  const firstPageSceneId = doc.pages.find((p) => p.id === activePageId)?.sceneId ?? "";
  const firstPageRootId = firstPageSceneId ? doc.scenes[firstPageSceneId]?.rootId ?? "" : "";

  return (
    <div>
      <div style={{ padding: 8, background: "#f0f0f0", display: "flex", gap: 8 }}>
        <button onClick={addPage}>+ Add Page</button>
        <button onClick={addNode}>+ Add Text Node</button>
        <span style={{ marginLeft: "auto" }}>
          Pages: {doc.pages.length} | Nodes: {Object.keys(scene.nodes).length}
        </span>
      </div>
      <Editor
        document={doc}
        registry={registry}
        context={{ pageId: firstPageRootId, mode: "editor" }}
      />
    </div>
  );
}

const root = createRoot(document.getElementById("root")!);
root.render(<App />);
