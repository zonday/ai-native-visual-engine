import { createScope } from "../deps/reactive-scope.js";
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

export interface ViewportRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ComputedStateEngine {
  getLocalTransform(nodeId: NodeId): { x: number; y: number; rotation: number };
  getWorldTransform(nodeId: NodeId): WorldTransform;
  getComputedBounds(nodeId: NodeId): ComputedBounds;
  getVisibleBounds(
    nodeId: NodeId,
    viewport?: ViewportRect,
  ): ComputedBounds | null;
  getCenter(nodeId: NodeId): { x: number; y: number };
  getEdge(nodeId: NodeId, edge: "top" | "bottom" | "left" | "right"): number;
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

export function createComputedStateEngine(
  selectors: SelectorRegistry,
): ComputedStateEngine {
  const { computed } = createScope();
  const worldCache = new Map<NodeId, () => WorldTransform>();
  const boundsCache = new Map<NodeId, () => ComputedBounds>();
  const visibleBoundsCache = new Map<string, () => ComputedBounds | null>();
  const centerCache = new Map<NodeId, () => { x: number; y: number }>();
  const localCache = new Map<
    NodeId,
    () => { x: number; y: number; rotation: number }
  >();

  let lastVersion = selectors.getVersion();

  function clearIfStale(): void {
    const currentVersion = selectors.getVersion();
    if (currentVersion === lastVersion) return;
    lastVersion = currentVersion;
    worldCache.clear();
    boundsCache.clear();
    visibleBoundsCache.clear();
    centerCache.clear();
    localCache.clear();
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

  const engine: ComputedStateEngine = {
    getLocalTransform(nodeId: NodeId): {
      x: number;
      y: number;
      rotation: number;
    } {
      clearIfStale();
      let c = localCache.get(nodeId);
      if (!c) {
        c = computed(() => {
          const node = selectors.getNode(nodeId);
          if (!node) return { x: 0, y: 0, rotation: 0 };
          return {
            x: getLayoutValue(node, "x"),
            y: getLayoutValue(node, "y"),
            rotation: getLayoutValue(node, "rotation"),
          };
        });
        localCache.set(nodeId, c);
      }
      return c();
    },

    getWorldTransform(nodeId: NodeId): WorldTransform {
      clearIfStale();
      let c = worldCache.get(nodeId);
      if (!c) {
        c = computed(() => {
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

          const parentTx = engine.getWorldTransform(parent.id);
          return {
            x: parentTx.x + local.x,
            y: parentTx.y + local.y,
            rotation: parentTx.rotation + rotation,
            scaleX: parentTx.scaleX,
            scaleY: parentTx.scaleY,
          };
        });
        worldCache.set(nodeId, c);
      }
      return c();
    },

    getComputedBounds(nodeId: NodeId): ComputedBounds {
      clearIfStale();
      let c = boundsCache.get(nodeId);
      if (!c) {
        c = computed(() => {
          const node = selectors.getNode(nodeId);
          if (!node) {
            return { x: 0, y: 0, width: 0, height: 0 };
          }

          const tx = engine.getWorldTransform(nodeId);
          const w = getNodeWidth(node);
          const h = getNodeHeight(node);

          return {
            x: tx.x,
            y: tx.y,
            width: w,
            height: h,
          };
        });
        boundsCache.set(nodeId, c);
      }
      return c();
    },

    getVisibleBounds(
      nodeId: NodeId,
      viewport?: ViewportRect,
    ): ComputedBounds | null {
      clearIfStale();
      const cacheKey = viewport
        ? `vb:${nodeId}:${viewport.x},${viewport.y},${viewport.width},${viewport.height}`
        : `vb:${nodeId}`;
      let c = visibleBoundsCache.get(cacheKey);
      if (!c) {
        c = computed(() => {
          const node = selectors.getNode(nodeId);
          if (!node || node.visible === false) {
            return null;
          }

          const bounds = engine.getComputedBounds(nodeId);

          if (!viewport) {
            return bounds;
          }

          const ix = Math.max(bounds.x, viewport.x);
          const iy = Math.max(bounds.y, viewport.y);
          const ir = Math.min(
            bounds.x + bounds.width,
            viewport.x + viewport.width,
          );
          const ib = Math.min(
            bounds.y + bounds.height,
            viewport.y + viewport.height,
          );
          const iw = Math.max(0, ir - ix);
          const ih = Math.max(0, ib - iy);

          return iw > 0 && ih > 0
            ? { x: ix, y: iy, width: iw, height: ih }
            : { x: 0, y: 0, width: 0, height: 0 };
        });
        visibleBoundsCache.set(cacheKey, c);
      }
      return c();
    },

    getCenter(nodeId: NodeId): { x: number; y: number } {
      clearIfStale();
      let c = centerCache.get(nodeId);
      if (!c) {
        c = computed(() => {
          const bounds = engine.getComputedBounds(nodeId);
          return {
            x: bounds.x + bounds.width / 2,
            y: bounds.y + bounds.height / 2,
          };
        });
        centerCache.set(nodeId, c);
      }
      return c();
    },

    getEdge(nodeId: NodeId, edge: "top" | "bottom" | "left" | "right"): number {
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

    invalidate(nodeId: NodeId): void {
      worldCache.delete(nodeId);
      boundsCache.delete(nodeId);
      centerCache.delete(nodeId);
      localCache.delete(nodeId);
      for (const key of visibleBoundsCache.keys()) {
        if (key === `vb:${nodeId}` || key.startsWith(`vb:${nodeId}:`)) {
          visibleBoundsCache.delete(key);
        }
      }
    },

    invalidateAll(): void {
      worldCache.clear();
      boundsCache.clear();
      visibleBoundsCache.clear();
      centerCache.clear();
      localCache.clear();
    },
  };

  return engine;
}
