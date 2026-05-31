import type { Engine, NodeId, SceneNode } from "@ai-native/core";
import { useCallback, useSyncExternalStore } from "react";

function subscribeEngine(
  engine: Engine,
  onStoreChange: () => void,
): () => void {
  return engine.events.on("scene", () => onStoreChange());
}

export function useNode(
  engine: Engine,
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
  engine: Engine,
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
  engine: Engine,
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
  engine: Engine,
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
  engine: Engine,
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
  engine: Engine,
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
