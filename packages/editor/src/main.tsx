import "./index.css";
import { Redo2, Undo2 } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { createRoot } from "react-dom/client";
import { commandRegistry } from "./commands/command-registry.js";
import type { Command } from "./commands/types.js";
import { Button } from "./components/ui/button.js";
import { Editor } from "./Editor.js";
import { useCommands } from "./hooks/use-commands.js";
import { useEditorActions } from "./hooks/use-editor-actions.js";
import { useEditorEngines } from "./hooks/use-editor-engines.js";
import { useEditorState } from "./hooks/use-editor-state.js";
import { useHotkey } from "./hooks/use-hotkey.js";
import { DebugPanel } from "./panels/debug-panel.js";
import { useEditorStore } from "./store.js";

function App() {
  // State management
  const {
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
  } = useEditorState();

  // Engine and command bus creation
  const engines = useEditorEngines(
    scene,
    doc,
    activePageId,
    historyRef,
    isUndoingRef,
    syncHistoryState,
  );
  const {
    selectorRegistry,
    interactionEngine,
    computedEngineRef,
    schedulerRef,
    registry,
  } = engines;

  // Action handler callbacks
  const {
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
  } = useEditorActions(
    engines,
    scene,
    activePageId,
    doc,
    setDoc,
    setScene,
    historyRef,
    isUndoingRef,
    syncHistoryState,
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
          onClick={() => addNode("text")}
          className="px-2 py-1 bg-white border border-slate-300 rounded text-xs hover:bg-slate-50 cursor-pointer"
        >
          + Add Text
        </button>
        <button
          type="button"
          onClick={() => addNode("container", { mode: "flex" })}
          className="px-2 py-1 bg-white border border-slate-300 rounded text-xs hover:bg-slate-50 cursor-pointer"
        >
          + Container
        </button>
        <button
          type="button"
          onClick={() =>
            addNode("grid", { mode: "grid", gridColumns: 3, gap: 8 })
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
              {cmd.id === "undo" && <Undo2 size={14} className="mr-1" />}
              {cmd.id === "redo" && <Redo2 size={14} className="mr-1" />}
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
        <button
          type="button"
          onClick={() => setShowDebug((v) => !v)}
          className={`px-2 py-1 border rounded text-xs cursor-pointer ${
            showDebug
              ? "bg-blue-100 border-blue-400 text-blue-700"
              : "bg-white border-slate-300 text-slate-600 hover:bg-slate-50"
          }`}
        >
          🐞 Debug
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
      {showDebug && (
        <aside className="w-80 border-l border-slate-200 overflow-auto shrink-0">
          <DebugPanel
            doc={doc}
            scene={currentScene}
            history={historyRef.current}
          />
        </aside>
      )}
    </div>
  );
}

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element not found");
}

const root = createRoot(rootElement);
root.render(<App />);
