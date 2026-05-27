import type { SelectorRegistry } from "../selector/selector-registry.js";
import type { NodeId, SceneNode } from "../types.js";

export interface WorldTransform {
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
}

export interface ComputedBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ComputedStateEngine {
  getWorldTransform(nodeId: NodeId): WorldTransform;
  getComputedBounds(nodeId: NodeId): ComputedBounds;
  getVisibleBounds(nodeId: NodeId): ComputedBounds | null;
  getCenter(nodeId: NodeId): { x: number; y: number };
  getEdge(
    nodeId: NodeId,
    edge: "top" | "bottom" | "left" | "right",
  ): number;
  invalidate(nodeId: NodeId): void;
  invalidateAll(): void;
}

function getLayoutValue(node: SceneNode, key: string): number {
  const layout = node.layout;
  if (layout && typeof layout === "object" && key in layout) {
    const value = (layout as Record<string, unknown>)[key];
    return typeof value === "number" ? value : 0;
  }
  return 0;
}

function getNodeWidth(node: SceneNode): number {
  const w = getLayoutValue(node, "width");
  if (w > 0) return w;
  if (node.type === "text") return 150;
  if (node.type === "container" && node.children && node.children.length > 0)
    return 300;
  return 100;
}

function getNodeHeight(node: SceneNode): number {
  const h = getLayoutValue(node, "height");
  if (h > 0) return h;
  if (node.type === "text") return 24;
  if (node.type === "container" && node.children && node.children.length > 0)
    return 200;
  return 100;
}

type CacheEntry<T> = { value: T } | undefined;

export function createComputedStateEngine(
  selectors: SelectorRegistry,
): ComputedStateEngine {
  const worldCache = new Map<string, CacheEntry<WorldTransform>>();
  const boundsCache = new Map<string, CacheEntry<ComputedBounds>>();
  const visibleBoundsCache = new Map<string, CacheEntry<ComputedBounds | null>>();
  const centerCache = new Map<string, CacheEntry<{ x: number; y: number }>>();

  let lastVersion = selectors.getVersion();

  function clearIfStale(): void {
    const currentVersion = selectors.getVersion();
    if (currentVersion === lastVersion) return;
    lastVersion = currentVersion;
    worldCache.clear();
    boundsCache.clear();
    visibleBoundsCache.clear();
    centerCache.clear();
  }

  function getWorldSpaceLayout(node: SceneNode): {
    x: number;
    y: number;
  } {
    const mode = (node.layout as { mode?: string } | undefined)?.mode;
    if (mode === "absolute" || mode === "free") {
      return {
        x: getLayoutValue(node, "x"),
        y: getLayoutValue(node, "y"),
      };
    }
    return { x: 0, y: 0 };
  }

  function computeWorldTransform(nodeId: NodeId): WorldTransform {
    const node = selectors.getNode(nodeId);
    if (!node) {
      return { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 };
    }

    const local = getWorldSpaceLayout(node);
    const rotation = getLayoutValue(node, "rotation");
    const parent = selectors.getParent(nodeId);

    if (!parent) {
      return {
        x: local.x,
        y: local.y,
        rotation,
        scaleX: 1,
        scaleY: 1,
      };
    }

    const parentTx = computeWorldTransform(parent.id);
    return {
      x: parentTx.x + local.x,
      y: parentTx.y + local.y,
      rotation: parentTx.rotation + rotation,
      scaleX: parentTx.scaleX,
      scaleY: parentTx.scaleY,
    };
  }

  function computeBounds(nodeId: NodeId): ComputedBounds {
    const node = selectors.getNode(nodeId);
    if (!node) {
      return { x: 0, y: 0, width: 0, height: 0 };
    }

    const tx = computeWorldTransform(nodeId);
    const w = getNodeWidth(node);
    const h = getNodeHeight(node);

    return {
      x: tx.x,
      y: tx.y,
      width: w,
      height: h,
    };
  }

  const engine: ComputedStateEngine = {
    getWorldTransform(nodeId: NodeId): WorldTransform {
      clearIfStale();
      const existing = worldCache.get(nodeId);
      if (existing) return existing.value;
      const value = computeWorldTransform(nodeId);
      worldCache.set(nodeId, { value });
      return value;
    },

    getComputedBounds(nodeId: NodeId): ComputedBounds {
      clearIfStale();
      const existing = boundsCache.get(nodeId);
      if (existing) return existing.value;
      const value = computeBounds(nodeId);
      boundsCache.set(nodeId, { value });
      return value;
    },

    getVisibleBounds(nodeId: NodeId): ComputedBounds | null {
      clearIfStale();
      const existing = visibleBoundsCache.get(nodeId);
      if (existing !== undefined) return existing.value;

      const node = selectors.getNode(nodeId);
      if (!node || node.visible === false) {
        visibleBoundsCache.set(nodeId, { value: null });
        return null;
      }

      const bounds = computeBounds(nodeId);
      visibleBoundsCache.set(nodeId, { value: bounds });
      return bounds;
    },

    getCenter(nodeId: NodeId): { x: number; y: number } {
      clearIfStale();
      const existing = centerCache.get(nodeId);
      if (existing) return existing.value;
      const bounds = computeBounds(nodeId);
      const value = {
        x: bounds.x + bounds.width / 2,
        y: bounds.y + bounds.height / 2,
      };
      centerCache.set(nodeId, { value });
      return value;
    },

    getEdge(
      nodeId: NodeId,
      edge: "top" | "bottom" | "left" | "right",
    ): number {
      const bounds = engine.getComputedBounds(nodeId);
      switch (edge) {
        case "top":
          return bounds.y;
        case "bottom":
          return bounds.y + bounds.height;
        case "left":
          return bounds.x;
        case "right":
          return bounds.x + bounds.width;
      }
    },

    invalidate(_nodeId: NodeId): void {
      worldCache.clear();
      boundsCache.clear();
      visibleBoundsCache.clear();
      centerCache.clear();
    },

    invalidateAll(): void {
      worldCache.clear();
      boundsCache.clear();
      visibleBoundsCache.clear();
      centerCache.clear();
    },
  };

  return engine;
}
