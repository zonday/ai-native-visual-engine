import type { EngineFacade, NodeId } from "@ai-native/core";
import { useCallback, useSyncExternalStore } from "react";

function subscribeComputed(
  engine: EngineFacade,
  onStoreChange: () => void,
): () => void {
  return engine.selector.autorun(() => onStoreChange());
}

export function useWorldTransform(
  engine: EngineFacade,
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
  engine: EngineFacade,
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
  engine: EngineFacade,
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
