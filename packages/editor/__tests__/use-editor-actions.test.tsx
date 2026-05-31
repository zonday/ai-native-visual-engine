// @vitest-environment happy-dom

import type {
  DocumentAction,
  HistoryState,
  RuntimeAction,
  SceneGraph,
  VisualDocument,
} from "@ai-native/core";
import { render, waitFor } from "@testing-library/react";
import { useEffect, useRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { useEditorActions } from "../src/hooks/use-editor-actions.js";
import type { EditorEngines } from "../src/hooks/use-editor-engines.js";
import type { EditorAction } from "../src/hooks/use-editor-state.js";

function createDocument(): VisualDocument {
  return {
    id: "doc-1",
    title: "Doc",
    pages: [{ id: "page-1", name: "Page 1", sceneId: "scene-1" }],
    scenes: {
      "scene-1": {
        version: 0,
        rootId: "root",
        nodes: {
          root: { id: "root", type: "container", children: ["a"] },
          a: { id: "a", type: "text", parentId: "root" },
        },
      },
    },
  };
}

function createRuntimeScene(): SceneGraph {
  return {
    version: 1,
    rootId: "root",
    nodes: {
      root: { id: "root", type: "container", children: ["a"] },
      a: {
        id: "a",
        type: "text",
        parentId: "root",
        layout: { mode: "bogus", extra: true },
        runtime: { preview: true },
      },
    },
    selection: { nodeIds: ["a"] },
    viewport: { x: 12, y: 24, zoom: 1.5 },
  } as unknown as SceneGraph;
}

function createEngines(scene: SceneGraph): EditorEngines {
  return {
    selectorRegistry: {
      getNode: (id: string) => scene.nodes[id],
      getParent: () => undefined,
      getChildren: () => [],
    } as unknown as EditorEngines["selectorRegistry"],
    interactionEngine: {
      getSelection: () => [],
      select: () => {},
    } as unknown as EditorEngines["interactionEngine"],
    constraintRegistry: {} as EditorEngines["constraintRegistry"],
    runtimeRegistries: {} as EditorEngines["runtimeRegistries"],
    runtimeTm: {} as EditorEngines["runtimeTm"],
    transactionFlagRef: {
      current: { isActive: () => false, setActive: () => {} },
    } as EditorEngines["transactionFlagRef"],
    schedulerRef: {
      current: { subscribe: () => () => {} },
    } as unknown as EditorEngines["schedulerRef"],
    computedEngineRef: { current: {} } as EditorEngines["computedEngineRef"],
    runtimeBus: {
      dispatch: vi.fn(() => ({ ok: true, scene })),
    } as unknown as EditorEngines["runtimeBus"],
    documentBus: {
      dispatch: vi.fn((_action: DocumentAction) => ({ ok: false })),
    } as unknown as EditorEngines["documentBus"],
    registry: new Map(),
  } as unknown as EditorEngines;
}

function Harness({
  runtimeScene,
  onDocument,
  mode = "dispatchRuntime",
}: {
  runtimeScene: SceneGraph;
  onDocument: (doc: VisualDocument) => void;
  mode?: "dispatchRuntime" | "undo" | "redo";
}) {
  const [doc, setDoc] = useState<VisualDocument>(() => createDocument());
  const [scene, setScene] = useState<SceneGraph>(() => createRuntimeScene());
  const dispatchedRef = useRef(false);
  const historyRef = useRef<HistoryState<EditorAction>>({
    undoStack:
      mode === "undo"
        ? [
            {
              action: {
                type: "update-runtime",
                nodeId: "a",
                runtime: { preview: true },
              } as unknown as EditorAction,
              inverseActions: [
                {
                  type: "update-runtime",
                  nodeId: "a",
                  runtime: { preview: true },
                } as unknown as EditorAction,
              ],
              timestamp: Date.now(),
            },
          ]
        : [],
    redoStack:
      mode === "redo"
        ? [
            {
              action: {
                type: "update-runtime",
                nodeId: "a",
                runtime: { preview: true },
              } as unknown as EditorAction,
              actions: [
                {
                  type: "update-runtime",
                  nodeId: "a",
                  runtime: { preview: true },
                } as unknown as EditorAction,
              ],
              timestamp: Date.now(),
            },
          ]
        : [],
  } as HistoryState<EditorAction>);
  const isUndoingRef = useRef(false);
  const engines = createEngines(runtimeScene);
  const actions = useEditorActions(
    engines,
    scene,
    "page-1",
    doc,
    setDoc,
    setScene,
    historyRef,
    isUndoingRef,
    () => {},
  );

  useEffect(() => {
    if (dispatchedRef.current) return;
    dispatchedRef.current = true;
    if (mode === "undo") {
      actions.handleUndo();
      return;
    }
    if (mode === "redo") {
      actions.handleRedo();
      return;
    }
    actions.dispatchRuntime({
      type: "update-runtime",
      nodeId: "a",
      runtime: { preview: true },
    } as RuntimeAction);
  }, [actions, mode]);

  useEffect(() => {
    onDocument(doc);
  }, [doc, onDocument]);

  return null;
}

describe("useEditorActions", () => {
  it("persists runtime scenes through the persisted scene converter", async () => {
    const runtimeScene = createRuntimeScene();
    const onDocument = vi.fn();

    render(<Harness runtimeScene={runtimeScene} onDocument={onDocument} />);

    await waitFor(() => {
      const latest = onDocument.mock.calls.at(-1)?.[0] as
        | VisualDocument
        | undefined;
      const persistedScene = latest?.scenes["scene-1"] as
        | (VisualDocument["scenes"][string] & Record<string, unknown>)
        | undefined;
      expect(persistedScene?.selection).toBeUndefined();
      expect(persistedScene?.viewport).toBeUndefined();
      expect(persistedScene?.nodes.a?.layout).toBeUndefined();
      expect(persistedScene?.nodes.a?.runtime).toEqual({
        preview: true,
      });
    });
  });

  it("persists undo-applied runtime scenes through the persisted scene converter", async () => {
    const runtimeScene = createRuntimeScene();
    const onDocument = vi.fn();

    render(
      <Harness
        runtimeScene={runtimeScene}
        onDocument={onDocument}
        mode="undo"
      />,
    );

    await waitFor(() => {
      const latest = onDocument.mock.calls.at(-1)?.[0] as
        | VisualDocument
        | undefined;
      const persistedScene = latest?.scenes["scene-1"] as
        | (VisualDocument["scenes"][string] & Record<string, unknown>)
        | undefined;
      expect(persistedScene?.selection).toBeUndefined();
      expect(persistedScene?.viewport).toBeUndefined();
      expect(persistedScene?.nodes.a?.layout).toBeUndefined();
      expect(persistedScene?.nodes.a?.runtime).toEqual({
        preview: true,
      });
    });
  });

  it("persists redo-applied runtime scenes through the persisted scene converter", async () => {
    const runtimeScene = createRuntimeScene();
    const onDocument = vi.fn();

    render(
      <Harness
        runtimeScene={runtimeScene}
        onDocument={onDocument}
        mode="redo"
      />,
    );

    await waitFor(() => {
      const latest = onDocument.mock.calls.at(-1)?.[0] as
        | VisualDocument
        | undefined;
      const persistedScene = latest?.scenes["scene-1"] as
        | (VisualDocument["scenes"][string] & Record<string, unknown>)
        | undefined;
      expect(persistedScene?.selection).toBeUndefined();
      expect(persistedScene?.viewport).toBeUndefined();
      expect(persistedScene?.nodes.a?.layout).toBeUndefined();
      expect(persistedScene?.nodes.a?.runtime).toEqual({
        preview: true,
      });
    });
  });
});
