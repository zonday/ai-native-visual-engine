import type {
  DocumentAction,
  HistoryState,
  RuntimeAction,
  SceneGraph,
  VisualDocument,
} from "@ai-native/core";
import {
  type ActionRegistry,
  createBatchHandler,
  createComputedStateEngine,
  createConstraintMiddleware,
  createConstraintRegistry,
  createDocumentRegistry,
  createDocumentBatchHandler,
  createDocumentCommandBus,
  createInteractionEngine,
  createRuntimeCommandBus,
  createRuntimeRegistry,
  createRuntimeTransactionManager,
  createScheduler,
  createSelectorRegistry,
  createTransactionFlag,
  createTransactionMiddleware,
  createUndoHistoryMiddleware,
  createValidatorMiddleware,
  DEFAULT_LAYOUT_CONSTRAINTS,
  DocumentActionSchema,
  RuntimeActionSchema,
  splitRegistry,
  validateGraphInvariants,
} from "@ai-native/core";
import { createRendererRegistry } from "@ai-native/renderer-react";
import { useMemo, useRef } from "react";
import type { EditorAction } from "./use-editor-state.js";

export interface EditorEngines {
  selectorRegistry: ReturnType<typeof createSelectorRegistry>;
  interactionEngine: ReturnType<typeof createInteractionEngine>;
  constraintRegistry: ReturnType<typeof createConstraintRegistry>;
  runtimeRegistries: ActionRegistry<RuntimeAction, SceneGraph, import("@ai-native/core").RuntimeContext>;
  runtimeTm: ReturnType<typeof createRuntimeTransactionManager>;
  transactionFlagRef: React.MutableRefObject<
    ReturnType<typeof createTransactionFlag>
  >;
  schedulerRef: React.MutableRefObject<ReturnType<typeof createScheduler>>;
  computedEngineRef: React.MutableRefObject<
    ReturnType<typeof createComputedStateEngine>
  >;
  runtimeBus: ReturnType<typeof createRuntimeCommandBus>;
  documentBus: ReturnType<typeof createDocumentCommandBus>;
  registry: ReturnType<typeof createRendererRegistry>;
}

export function useEditorEngines(
  scene: SceneGraph,
  doc: VisualDocument,
  _activePageId: string,
  historyRef: React.MutableRefObject<HistoryState<EditorAction>>,
  isUndoingRef: React.MutableRefObject<boolean>,
  syncHistoryState: () => void,
): EditorEngines {
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
      createRuntimeRegistry(() => ({
        ok: false,
        scene: { version: 0, rootId: "", nodes: {} },
        error: { code: "nested", message: "nested" },
      })),
    [],
  );

  const transactionFlagRef = useRef(createTransactionFlag());

  const runtimeTm = useMemo(() => {
    const { handlerRegistry, inverseRegistry } = splitRegistry(runtimeRegistries);
    return createRuntimeTransactionManager(
      handlerRegistry as never,
      inverseRegistry as never,
    );
  }, [runtimeRegistries]);

  const schedulerRef = useRef(createScheduler({ mode: "microtask" }));
  const computedEngineRef = useRef(createComputedStateEngine(selectorRegistry));

  const runtimeBus = useMemo(() => {
    const { handlerRegistry } = splitRegistry(runtimeRegistries);
    const middlewares = [
      createValidatorMiddleware<SceneGraph, RuntimeAction>(RuntimeActionSchema),
      createConstraintMiddleware(constraintRegistry),
      createTransactionMiddleware({
        transactionManager: runtimeTm,
        transactionFlag: transactionFlagRef.current,
        handlerRegistry,
        getContext: () => ({ now: Date.now, actorId: "editor" }),
        getActorId: () => "editor",
        getHistory: () => historyRef.current as HistoryState<RuntimeAction>,
        setHistory: (s) => {
          historyRef.current = s as HistoryState<EditorAction>;
          syncHistoryState();
        },
        markDirty: (nodeIds) => {
          schedulerRef.current.markDirty(nodeIds);
          for (const id of nodeIds) {
            computedEngineRef.current.invalidate(id);
          }
        },
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
    historyRef,
    isUndoingRef,
  ]);

  const documentBus = useMemo(() => {
    const { handlerRegistry } = splitRegistry(
      createDocumentRegistry(() => ({
        ok: false,
        document: doc,
        error: { code: "nested", message: "nested" },
      })),
    );
    const middlewares = [
      createValidatorMiddleware<VisualDocument, DocumentAction>(
        DocumentActionSchema,
      ),
      createUndoHistoryMiddleware(
        () => historyRef.current as HistoryState<DocumentAction>,
        (s: HistoryState<DocumentAction>) => {
          historyRef.current = s as HistoryState<EditorAction>;
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
  }, [doc, syncHistoryState, historyRef, isUndoingRef]);

  const registry = useMemo(() => createRendererRegistry(), []);

  return {
    selectorRegistry,
    interactionEngine,
    constraintRegistry,
    runtimeRegistries,
    runtimeTm,
    transactionFlagRef,
    schedulerRef,
    computedEngineRef,
    runtimeBus,
    documentBus,
    registry,
  };
}
