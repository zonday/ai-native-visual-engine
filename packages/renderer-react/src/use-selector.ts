import type { EngineFacade, NodeId, SceneNode } from "@ai-native/core";
import { useCallback, useSyncExternalStore } from "react";

function subscribeEngine(
  engine: EngineFacade,
  onStoreChange: () => void,
): () => void {
  return engine.selector.autorun(() => onStoreChange());
}

export function useNode(
  engine: EngineFacade,
  id: NodeId,
): Readonly<SceneNode> | undefined {
  const subscribe = useCallback(
    (cb: () => void) => subscribeEngine(engine, cb),
    [engine],
  );
  return useSyncExternalStore(
    subscribe,
    () => engine.selector.getNode(id),
    () => engine.selector.getNode(id),
  );
}

export function useNodeProps(
  engine: EngineFacade,
  id: NodeId,
): Readonly<Record<string, unknown>> {
  const subscribe = useCallback(
    (cb: () => void) => subscribeEngine(engine, cb),
    [engine],
  );
  return useSyncExternalStore(
    subscribe,
    () => engine.selector.getNodeProps(id) ?? {},
    () => engine.selector.getNodeProps(id) ?? {},
  );
}

export function useNodeLayout(
  engine: EngineFacade,
  id: NodeId,
): Record<string, unknown> | undefined {
  const subscribe = useCallback(
    (cb: () => void) => subscribeEngine(engine, cb),
    [engine],
  );
  return useSyncExternalStore(
    subscribe,
    () => engine.selector.getNodeLayout(id),
    () => engine.selector.getNodeLayout(id),
  );
}

export function useNodeVisibility(
  engine: EngineFacade,
  id: NodeId,
): boolean | undefined {
  const subscribe = useCallback(
    (cb: () => void) => subscribeEngine(engine, cb),
    [engine],
  );
  return useSyncExternalStore(
    subscribe,
    () => engine.selector.getNodeVisibility(id),
    () => engine.selector.getNodeVisibility(id),
  );
}

export function useChildren(
  engine: EngineFacade,
  id: NodeId,
): readonly Readonly<SceneNode>[] {
  const subscribe = useCallback(
    (cb: () => void) => subscribeEngine(engine, cb),
    [engine],
  );
  return useSyncExternalStore(
    subscribe,
    () => engine.selector.getChildren(id),
    () => engine.selector.getChildren(id),
  );
}

export function useParent(
  engine: EngineFacade,
  id: NodeId,
): Readonly<SceneNode> | undefined {
  const subscribe = useCallback(
    (cb: () => void) => subscribeEngine(engine, cb),
    [engine],
  );
  return useSyncExternalStore(
    subscribe,
    () => engine.selector.getParent(id),
    () => engine.selector.getParent(id),
  );
}
