import type { Engine, NodeId } from "@ai-native/core";
import { useCallback, useSyncExternalStore } from "react";

function subscribeComputed(
  engine: Engine,
  onStoreChange: () => void,
): () => void {
  return engine.events.on("scene", () => onStoreChange());
}

export function useWorldTransform(
  engine: Engine,
  id: NodeId,
): { x: number; y: number; rotation: number; scaleX: number; scaleY: number } {
  const subscribe = useCallback(
    (cb: () => void) => subscribeComputed(engine, cb),
    [engine],
  );
  return useSyncExternalStore(
    subscribe,
    () => engine.computed.getWorldTransform(id),
    () => engine.computed.getWorldTransform(id),
  );
}

export function useComputedBounds(
  engine: Engine,
  id: NodeId,
): { x: number; y: number; width: number; height: number } {
  const subscribe = useCallback(
    (cb: () => void) => subscribeComputed(engine, cb),
    [engine],
  );
  return useSyncExternalStore(
    subscribe,
    () => engine.computed.getComputedBounds(id),
    () => engine.computed.getComputedBounds(id),
  );
}

export function useCenter(
  engine: Engine,
  id: NodeId,
): { x: number; y: number } {
  const subscribe = useCallback(
    (cb: () => void) => subscribeComputed(engine, cb),
    [engine],
  );
  return useSyncExternalStore(
    subscribe,
    () => engine.computed.getCenter(id),
    () => engine.computed.getCenter(id),
  );
}
