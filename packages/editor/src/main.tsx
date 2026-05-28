import "./index.css";
import type {
  DocumentAction,
  DocumentHistoryState,
  RuntimeAction,
  SceneGraph,
  VisualDocument,
} from "@ai-native/core";
import {
  createBatchHandler,
  createComputedStateEngine,
  createConstraintMiddleware,
  createConstraintRegistry,
  createDefaultDocumentRegistries,
  createDefaultRuntimeRegistries,
  createDocumentBatchHandler,
  createDocumentCommandBus,
  createDocumentHistoryState,
  createInteractionEngine,
  createNewDocument,
  createRuntimeCommandBus,
  createRuntimeHistoryState,
  createRuntimeTransactionManager,
  createScheduler,
  createSelectorRegistry,
  createTransactionFlag,
  createTransactionMiddleware,
  createUndoHistoryMiddleware,
  createValidatorMiddleware,
  DEFAULT_LAYOUT_CONSTRAINTS,
  DocumentActionSchema,
  openDocumentSession,
  RuntimeActionSchema,
  redoDocumentAction,
  redoRuntimeAction,
  undoDocumentAction,
  undoRuntimeAction,
  validateGraphInvariants,
} from "@ai-native/core";
import type { TransformEvent } from "@ai-native/renderer-react";
import { createRendererRegistry } from "@ai-native/renderer-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { commandRegistry } from "./commands/command-registry.js";
import type { Command } from "./commands/types.js";
import { Button } from "./components/ui/button.js";
import { Editor } from "./Editor.js";
import { useCommands } from "./hooks/use-commands.js";
import { useHotkey } from "./hooks/use-hotkey.js";
import { useEditorStore } from "./store.js";

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
  const isUndoingRef = useRef(false);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const syncHistoryState = useCallback(() => {
    setCanUndo(
      runtimeHistoryRef.current.undoStack.length > 0 ||
        documentHistoryRef.current.undoStack.length > 0,
    );
    setCanRedo(
      runtimeHistoryRef.current.redoStack.length > 0 ||
        documentHistoryRef.current.redoStack.length > 0,
    );
  }, []);

  const selectorRegistry = useMemo(
    () => createSelectorRegistry(scene),
    [scene],
  );

  const interactionEngine = useMemo(() => createInteractionEngine(), []);

  const constraintRegistry = useMemo(() => {
    const reg = createConstraintRegistry();
    for (const c of DEFAULT_LAYOUT_CONSTRAINTS) {
      reg.register(c);
    }
    return reg;
  }, []);

  const runtimeRegistries = useMemo(
    () =>
      createDefaultRuntimeRegistries(() => ({
        ok: false,
        scene: { version: 0, rootId: "", nodes: {} },
        error: { code: "nested", message: "nested" },
      })),
    [],
  );

  const transactionFlagRef = useRef(createTransactionFlag());

  const runtimeTm = useMemo(
    () =>
      createRuntimeTransactionManager(
        runtimeRegistries.handlerRegistry,
        runtimeRegistries.inverseRegistry,
      ),
    [runtimeRegistries],
  );

  const schedulerRef = useRef(createScheduler({ mode: "sync" }));
  const computedEngineRef = useRef(createComputedStateEngine(selectorRegistry));

  // Wire interaction engine into scheduler — clear stale selections after compute
  useEffect(() => {
    const s = schedulerRef.current;
    return s.subscribe({
      onAfterCompute: () => {
        const selected = interactionEngine.getSelection();
        const valid = selected.filter((id) => selectorRegistry.getNode(id));
        if (valid.length !== selected.length) {
          interactionEngine.select(valid);
        }
      },
    });
  }, [interactionEngine, selectorRegistry]);

  const runtimeBus = useMemo(() => {
    const { handlerRegistry } = runtimeRegistries;
    const middlewares = [
      createValidatorMiddleware<SceneGraph, RuntimeAction>(RuntimeActionSchema),
      createConstraintMiddleware(constraintRegistry),
      createTransactionMiddleware({
        transactionManager: runtimeTm,
        transactionFlag: transactionFlagRef.current,
        handlerRegistry,
        getContext: () => ({ now: Date.now, actorId: "editor" }),
        getActorId: () => "editor",
        getHistory: () => runtimeHistoryRef.current,
        setHistory: (s) => {
          runtimeHistoryRef.current = s;
          syncHistoryState();
        },
        markDirty: (nodeIds) => schedulerRef.current.markDirty(nodeIds),
        shouldExcludeFromHistory: () => isUndoingRef.current,
        onAfterCommit: (sceneState) => {
          const violations = validateGraphInvariants(sceneState as SceneGraph);
          for (const v of violations) {
            console.error(`[graph-invariant] ${v.code}: ${v.message}`);
          }
        },
      }),
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
  }, [
    scene,
    constraintRegistry,
    syncHistoryState,
    runtimeTm,
    runtimeRegistries,
  ]);

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
        (s: DocumentHistoryState) => {
          documentHistoryRef.current = s;
          syncHistoryState();
        },
        () => "editor",
        handlerRegistry,
        () => ({ now: Date.now, actorId: "editor" }),
        () => isUndoingRef.current,
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
  }, [doc, syncHistoryState]);

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
      if (!event.commit) return;

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
    const rtHS = runtimeHistoryRef.current;
    const docHS = documentHistoryRef.current;
    const rtEntry = rtHS.undoStack.at(-1);
    const docEntry = docHS.undoStack.at(-1);
    if (!rtEntry && !docEntry) return;

    if (rtEntry && (!docEntry || rtEntry.timestamp >= docEntry.timestamp)) {
      const result = undoRuntimeAction(rtHS);
      if (!result) return;
      isUndoingRef.current = true;
      const dispatchResult = runtimeBus.dispatch(result.inverseAction);
      isUndoingRef.current = false;
      if (dispatchResult.ok) {
        runtimeHistoryRef.current = result.state;
        syncHistoryState();
        setScene(dispatchResult.scene);
        setDoc((d) => {
          const page = d.pages.find((p) => p.id === activePageId);
          if (!page) return d;
          return {
            ...d,
            scenes: {
              ...d.scenes,
              [page.sceneId]: {
                version: dispatchResult.scene.version,
                rootId: dispatchResult.scene.rootId,
                nodes: dispatchResult.scene.nodes,
                metadata: dispatchResult.scene.metadata,
              },
            },
          };
        });
      }
    } else if (docEntry) {
      const result = undoDocumentAction(docHS);
      if (!result) return;
      isUndoingRef.current = true;
      const dispatchResult = documentBus.dispatch(result.inverseAction);
      isUndoingRef.current = false;
      if (dispatchResult.ok) {
        documentHistoryRef.current = result.state;
        syncHistoryState();
        setDoc(dispatchResult.document);
      }
    }
  }, [runtimeBus, documentBus, activePageId, syncHistoryState]);

  const handleRedo = useCallback(() => {
    const rtHS = runtimeHistoryRef.current;
    const docHS = documentHistoryRef.current;
    const rtEntry = rtHS.redoStack.at(-1);
    const docEntry = docHS.redoStack.at(-1);
    if (!rtEntry && !docEntry) return;

    if (rtEntry && (!docEntry || rtEntry.timestamp >= docEntry.timestamp)) {
      const result = redoRuntimeAction(rtHS);
      if (!result) return;
      isUndoingRef.current = true;
      const dispatchResult = runtimeBus.dispatch(result.action);
      isUndoingRef.current = false;
      if (dispatchResult.ok) {
        runtimeHistoryRef.current = result.state;
        syncHistoryState();
        setScene(dispatchResult.scene);
        setDoc((d) => {
          const page = d.pages.find((p) => p.id === activePageId);
          if (!page) return d;
          return {
            ...d,
            scenes: {
              ...d.scenes,
              [page.sceneId]: {
                version: dispatchResult.scene.version,
                rootId: dispatchResult.scene.rootId,
                nodes: dispatchResult.scene.nodes,
                metadata: dispatchResult.scene.metadata,
              },
            },
          };
        });
      }
    } else if (docEntry) {
      const result = redoDocumentAction(docHS);
      if (!result) return;
      isUndoingRef.current = true;
      const dispatchResult = documentBus.dispatch(result.action);
      isUndoingRef.current = false;
      if (dispatchResult.ok) {
        documentHistoryRef.current = result.state;
        syncHistoryState();
        setDoc(dispatchResult.document);
      }
    }
  }, [runtimeBus, documentBus, activePageId, syncHistoryState]);

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

  const handleUndoRef = useRef(handleUndo);
  handleUndoRef.current = handleUndo;
  const handleRedoRef = useRef(handleRedo);
  handleRedoRef.current = handleRedo;
  const handleDeleteRef = useRef(handleDelete);
  handleDeleteRef.current = handleDelete;
  const canUndoRef = useRef(canUndo);
  canUndoRef.current = canUndo;
  const canRedoRef = useRef(canRedo);
  canRedoRef.current = canRedo;
  const handleMoveUpRef = useRef(() => handleMoveSelectedNode("up"));
  handleMoveUpRef.current = () => handleMoveSelectedNode("up");
  const handleMoveDownRef = useRef(() => handleMoveSelectedNode("down"));
  handleMoveDownRef.current = () => handleMoveSelectedNode("down");

  useEffect(() => {
    commandRegistry.register({
      id: "undo",
      label: "Undo",
      shortcut: { key: "z", ctrl: true },
      group: "edit",
      order: 1,
      when: () => canUndoRef.current,
      handler: () => handleUndoRef.current(),
    });
    commandRegistry.register({
      id: "redo",
      label: "Redo",
      shortcut: { key: "y", ctrl: true },
      group: "edit",
      order: 2,
      when: () => canRedoRef.current,
      handler: () => handleRedoRef.current(),
    });
    commandRegistry.register({
      id: "delete",
      label: "Delete",
      shortcut: { key: "delete" },
      group: "edit",
      order: 3,
      when: () => interactionEngine.getSelection().length > 0,
      handler: () => handleDeleteRef.current(),
    });
    commandRegistry.register({
      id: "layer-move-up",
      label: "Move Up",
      shortcut: { key: "ArrowUp", ctrl: true, shift: true },
      group: "edit",
      order: 4,
      when: () => interactionEngine.getSelection().length === 1,
      handler: () => handleMoveUpRef.current(),
    });
    commandRegistry.register({
      id: "layer-move-down",
      label: "Move Down",
      shortcut: { key: "ArrowDown", ctrl: true, shift: true },
      group: "edit",
      order: 5,
      when: () => interactionEngine.getSelection().length === 1,
      handler: () => handleMoveDownRef.current(),
    });

    return () => {
      commandRegistry.unregister("undo");
      commandRegistry.unregister("redo");
      commandRegistry.unregister("delete");
      commandRegistry.unregister("layer-move-up");
      commandRegistry.unregister("layer-move-down");
    };
  }, [interactionEngine]);

  const commands = useCommands();

  const hotkeyBindings = useMemo(
    () =>
      commands
        .filter(
          (
            cmd,
          ): cmd is Command & { shortcut: NonNullable<Command["shortcut"]> } =>
            !!cmd.shortcut,
        )
        .map((cmd) => ({
          ...cmd.shortcut,
          handler: () => commandRegistry.execute(cmd.id),
        })),
    [commands],
  );

  useHotkey(hotkeyBindings);

  const setViewport = useEditorStore((s) => s.setViewport);
  const canvasContainerRef = useRef<HTMLDivElement>(null);

  const handleDispatchDocument = useCallback(
    (action: DocumentAction) => {
      const result = documentBus.dispatch(action);
      if (result.ok) setDoc(result.document);
    },
    [documentBus],
  );

  const registry = useMemo(() => createRendererRegistry(), []);

  const firstPageSceneId =
    doc.pages.find((p) => p.id === activePageId)?.sceneId ?? "";
  const currentScene = firstPageSceneId
    ? (doc.scenes[firstPageSceneId] ?? scene)
    : scene;

  return (
    <div className="flex flex-col h-screen">
      <div className="flex items-center gap-2 px-2 py-1.5 bg-gray-100 border-b border-slate-200 text-sm shrink-0">
        <button
          type="button"
          onClick={addPage}
          className="px-2 py-1 bg-white border border-slate-300 rounded text-xs hover:bg-slate-50 cursor-pointer"
        >
          + Add Page
        </button>
        <button
          type="button"
          onClick={() => addNode("text", { width: 200 })}
          className="px-2 py-1 bg-white border border-slate-300 rounded text-xs hover:bg-slate-50 cursor-pointer"
        >
          + Add Text
        </button>
        <button
          type="button"
          onClick={() =>
            addNode("container", { mode: "flex", width: 400, height: 300 })
          }
          className="px-2 py-1 bg-white border border-slate-300 rounded text-xs hover:bg-slate-50 cursor-pointer"
        >
          + Container
        </button>
        <button
          type="button"
          onClick={() =>
            addNode("grid", {
              mode: "grid",
              gridColumns: 3,
              gap: 8,
              width: 600,
              height: 300,
            })
          }
          className="px-2 py-1 bg-white border border-slate-300 rounded text-xs hover:bg-slate-50 cursor-pointer"
        >
          + Grid
        </button>
        {commands
          .filter((cmd) => cmd.group === "edit")
          .map((cmd) => (
            <Button
              key={cmd.id}
              onClick={() => commandRegistry.execute(cmd.id)}
              disabled={cmd.when ? !cmd.when() : false}
            >
              {cmd.label === "Undo" ? "↩ " : cmd.label === "Redo" ? "↪ " : ""}
              {cmd.label}
            </Button>
          ))}
        <button
          type="button"
          onClick={() => {
            const nodes = selectorRegistry.getAllNodes();
            if (nodes.length === 0) return;
            let minX = Infinity,
              minY = Infinity,
              maxX = -Infinity,
              maxY = -Infinity;
            for (const n of nodes) {
              if (n.id === currentScene.rootId) continue;
              const b = computedEngineRef.current.getComputedBounds(n.id);
              minX = Math.min(minX, b.x);
              minY = Math.min(minY, b.y);
              maxX = Math.max(maxX, b.x + b.width);
              maxY = Math.max(maxY, b.y + b.height);
            }
            const w = maxX - minX || 1;
            const h = maxY - minY || 1;
            const rect = canvasContainerRef.current?.getBoundingClientRect();
            if (!rect) return;
            const containerW = rect.width;
            const containerH = rect.height;
            const zoom = Math.min(containerW / w, containerH / h, 1.5);
            setViewport({
              x: minX - (containerW / zoom - w) / 2,
              y: minY - (containerH / zoom - h) / 2,
              zoom,
            });
          }}
          className="px-2 py-1 bg-white border border-slate-300 rounded text-xs hover:bg-slate-50 cursor-pointer"
        >
          ⊞ Fit
        </button>
        <span className="ml-auto text-xs text-slate-500">
          Pages: {doc.pages.length} | Nodes:{" "}
          {selectorRegistry.getAllNodes().length}
        </span>
      </div>
      <Editor
        document={doc}
        registry={registry}
        context={{
          pageId: activePageId,
          mode: "editor",
          scene: currentScene,
          computedEngine: computedEngineRef.current,
          scheduler: schedulerRef.current,
        }}
        selectorRegistry={selectorRegistry}
        interactionEngine={interactionEngine}
        onTransform={handleTransform}
        onUpdateProps={handleUpdateProps}
        onViewportChange={setViewport}
        onDispatchRuntime={dispatchRuntime}
        onDispatchDocument={handleDispatchDocument}
        canvasContainerRef={canvasContainerRef}
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
