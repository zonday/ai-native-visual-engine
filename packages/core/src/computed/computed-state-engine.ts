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

function getLayoutValue(
  selectors: SelectorRegistry,
  nodeId: NodeId,
  key: string,
): number {
  const layout = selectors.getNodeLayout(nodeId);
  if (layout && typeof layout === "object" && key in layout) {
    const value = (layout as Record<string, unknown>)[key];
    return typeof value === "number" ? value : 0;
  }
  return 0;
}

function getNodeWidth(
  selectors: SelectorRegistry,
  node: SceneNode,
  nodeId: NodeId,
): number {
  const w = getLayoutValue(selectors, nodeId, "width");
  if (w > 0) return w;
  if (node.type === "text") return 150;
  if (node.type === "container" && node.children && node.children.length > 0)
    return 300;
  return 100;
}

function getNodeHeight(
  selectors: SelectorRegistry,
  node: SceneNode,
  nodeId: NodeId,
): number {
  const h = getLayoutValue(selectors, nodeId, "height");
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

  function getWorldSpaceLayout(
    selectors: SelectorRegistry,
    nodeId: NodeId,
  ): {
    x: number;
    y: number;
    rotation: number;
  } {
    const layout = selectors.getNodeLayout(nodeId);
    const mode = (layout as { mode?: string } | undefined)?.mode;
    if (mode === "absolute" || mode === "free") {
      return {
        x: getLayoutValue(selectors, nodeId, "x"),
        y: getLayoutValue(selectors, nodeId, "y"),
        rotation: getLayoutValue(selectors, nodeId, "rotation"),
      };
    }
    return { x: 0, y: 0, rotation: 0 };
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
            x: getLayoutValue(selectors, nodeId, "x"),
            y: getLayoutValue(selectors, nodeId, "y"),
            rotation: getLayoutValue(selectors, nodeId, "rotation"),
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

          const local = getWorldSpaceLayout(selectors, nodeId);
          const parent = selectors.getParent(nodeId);

          if (!parent) {
            return {
              x: local.x,
              y: local.y,
              rotation: local.rotation,
              scaleX: 1,
              scaleY: 1,
            };
          }

          const parentTx = engine.getWorldTransform(parent.id);
          return {
            x: parentTx.x + local.x,
            y: parentTx.y + local.y,
            rotation: parentTx.rotation + local.rotation,
            scaleX: 1,
            scaleY: 1,
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
          if (!node) return { x: 0, y: 0, width: 0, height: 0 };
          const w = getNodeWidth(selectors, node, nodeId);
          const h = getNodeHeight(selectors, node, nodeId);
          const tx = engine.getWorldTransform(nodeId);
          return { x: tx.x, y: tx.y, width: w, height: h };
        });
        boundsCache.set(nodeId, c);
      }
      return c();
    },

    getVisibleBounds(
      nodeId: NodeId,
      _viewport?: ViewportRect,
    ): ComputedBounds | null {
      clearIfStale();
      const key = _viewport
        ? `${nodeId}:${_viewport.x},${_viewport.y},${_viewport.width},${_viewport.height}`
        : nodeId;
      let c = visibleBoundsCache.get(key);
      if (!c) {
        c = computed(() => {
          const node = selectors.getNode(nodeId);
          if (!node) return null;
          const bounds = engine.getComputedBounds(nodeId);
          const visible = selectors.getNodeVisibility(nodeId);
          if (visible === false) return null;
          if (!_viewport) return bounds;
          const inView =
            bounds.x < _viewport.x + _viewport.width &&
            bounds.x + bounds.width > _viewport.x &&
            bounds.y < _viewport.y + _viewport.height &&
            bounds.y + bounds.height > _viewport.y;
          if (!inView) {
            return { x: bounds.x, y: bounds.y, width: 0, height: 0 };
          }
          return {
            x: Math.max(bounds.x, _viewport.x),
            y: Math.max(bounds.y, _viewport.y),
            width:
              Math.min(bounds.x + bounds.width, _viewport.x + _viewport.width) -
              Math.max(bounds.x, _viewport.x),
            height:
              Math.min(
                bounds.y + bounds.height,
                _viewport.y + _viewport.height,
              ) - Math.max(bounds.y, _viewport.y),
          };
        });
        visibleBoundsCache.set(key, c);
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
      if (edge === "top") return bounds.y;
      if (edge === "bottom") return bounds.y + bounds.height;
      if (edge === "left") return bounds.x;
      if (edge === "right") return bounds.x + bounds.width;
      return 0;
    },

    invalidate(nodeId: NodeId): void {
      selectors.invalidate(nodeId, "layout");
      worldCache.delete(nodeId);
      boundsCache.delete(nodeId);
      visibleBoundsCache.delete(nodeId);
      centerCache.delete(nodeId);
      localCache.delete(nodeId);
    },

    invalidateAll(): void {
      selectors.invalidateAll();
      worldCache.clear();
      boundsCache.clear();
      visibleBoundsCache.clear();
      centerCache.clear();
      localCache.clear();
    },
  };

  return engine;
}
