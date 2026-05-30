import { createScope } from "../deps/reactive-scope.js";
import type { SelectorRegistry } from "../selector/selector-registry.js";
import type { NodeId, SceneNode } from "../types.js";

// ── Public Types ──

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
  getLocalTransform(nodeId: NodeId): WorldTransform;
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

// ── Internal Types ──

type ComputedRef<T> = (() => T) & { dispose(): void };
type Edge = "top" | "bottom" | "left" | "right";

// ── Helpers ──

const DEG_TO_RAD = Math.PI / 180;

function getLayoutValue(
  selectors: SelectorRegistry,
  nodeId: NodeId,
  key: string,
): number {
  const value = selectors.getNodeLayoutKey(nodeId, key);
  return typeof value === "number" ? value : 0;
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

function composeWorldTransform(
  parent: WorldTransform,
  local: WorldTransform,
): WorldTransform {
  const rad = parent.rotation * DEG_TO_RAD;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  // Parent's rotation + scale applied to local offset
  const rx = local.x * parent.scaleX * cos - local.y * parent.scaleY * sin;
  const ry = local.x * parent.scaleX * sin + local.y * parent.scaleY * cos;

  return {
    x: parent.x + rx,
    y: parent.y + ry,
    rotation: parent.rotation + local.rotation,
    scaleX: parent.scaleX * local.scaleX,
    scaleY: parent.scaleY * local.scaleY,
  };
}

// ── Engine ──

export function createComputedStateEngine(
  selectors: SelectorRegistry,
): ComputedStateEngine {
  const { computed } = createScope();
  const worldCache = new Map<NodeId, ComputedRef<WorldTransform>>();
  const boundsCache = new Map<NodeId, ComputedRef<ComputedBounds>>();
  const visibleBoundsCache = new Map<
    NodeId,
    Map<string, ComputedRef<ComputedBounds | null>>
  >();
  const centerCache = new Map<NodeId, ComputedRef<{ x: number; y: number }>>();
  const localCache = new Map<NodeId, ComputedRef<WorldTransform>>();

  // When the selector registry syncs to a new SceneGraph (page switch, undo,
  // etc.), all our computed refs point to stale/dead SelectorNodes and must be
  // disposed before the registry's internal cleanup runs.
  selectors.onBeforeDispose(() => {
    clearAll();
  });

  function clearAll(): void {
    for (const c of worldCache.values()) c.dispose();
    worldCache.clear();
    for (const c of boundsCache.values()) c.dispose();
    boundsCache.clear();
    for (const inner of visibleBoundsCache.values()) {
      for (const c of inner.values()) c.dispose();
    }
    visibleBoundsCache.clear();
    for (const c of centerCache.values()) c.dispose();
    centerCache.clear();
    for (const c of localCache.values()) c.dispose();
    localCache.clear();
  }

  function disposeEntry<T>(
    cache: Map<NodeId, ComputedRef<T>>,
    nodeId: NodeId,
  ): void {
    cache.get(nodeId)?.dispose();
    cache.delete(nodeId);
  }

  function readLocalTransform(nodeId: NodeId): WorldTransform {
    const layout = selectors.getNodeLayout(nodeId);
    const mode = (layout as { mode?: string } | undefined)?.mode;
    if (mode === "absolute" || mode === "free") {
      return {
        x: getLayoutValue(selectors, nodeId, "x"),
        y: getLayoutValue(selectors, nodeId, "y"),
        rotation: getLayoutValue(selectors, nodeId, "rotation"),
        scaleX: getLayoutValue(selectors, nodeId, "scaleX") || 1,
        scaleY: getLayoutValue(selectors, nodeId, "scaleY") || 1,
      };
    }
    return { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 };
  }

  function toViewportKey(viewport: ViewportRect): string {
    return `${viewport.x},${viewport.y},${viewport.width},${viewport.height}`;
  }

  const engine: ComputedStateEngine = {
    getLocalTransform(nodeId: NodeId): WorldTransform {
      let c = localCache.get(nodeId);
      if (!c) {
        c = computed(() => {
          const node = selectors.getNode(nodeId);
          if (!node) {
            return { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 };
          }
          return readLocalTransform(nodeId);
        }) as ComputedRef<WorldTransform>;
        localCache.set(nodeId, c);
      }
      return c();
    },

    getWorldTransform(nodeId: NodeId): WorldTransform {
      let c = worldCache.get(nodeId);
      if (!c) {
        c = computed(() => {
          const node = selectors.getNode(nodeId);
          if (!node) {
            return { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 };
          }
          const local = readLocalTransform(nodeId);
          const parent = selectors.getParent(nodeId);
          if (!parent) {
            return local;
          }
          const parentTx = engine.getWorldTransform(parent.id);
          return composeWorldTransform(parentTx, local);
        }) as ComputedRef<WorldTransform>;
        worldCache.set(nodeId, c);
      }
      return c();
    },

    getComputedBounds(nodeId: NodeId): ComputedBounds {
      let c = boundsCache.get(nodeId);
      if (!c) {
        c = computed(() => {
          const node = selectors.getNode(nodeId);
          if (!node) return { x: 0, y: 0, width: 0, height: 0 };
          const w = getNodeWidth(selectors, node, nodeId);
          const h = getNodeHeight(selectors, node, nodeId);
          const tx = engine.getWorldTransform(nodeId);
          return { x: tx.x, y: tx.y, width: w, height: h };
        }) as ComputedRef<ComputedBounds>;
        boundsCache.set(nodeId, c);
      }
      return c();
    },

    getVisibleBounds(
      nodeId: NodeId,
      viewport?: ViewportRect,
    ): ComputedBounds | null {
      const key = viewport ? toViewportKey(viewport) : "";
      let inner = visibleBoundsCache.get(nodeId);
      if (!inner) {
        inner = new Map();
        visibleBoundsCache.set(nodeId, inner);
      }
      let c = inner.get(key);
      if (!c) {
        c = computed(() => {
          const node = selectors.getNode(nodeId);
          if (!node) return null;
          const bounds = engine.getComputedBounds(nodeId);
          const visible = selectors.getNodeVisibility(nodeId);
          if (visible === false) return null;
          if (!viewport) return bounds;
          const inView =
            bounds.x < viewport.x + viewport.width &&
            bounds.x + bounds.width > viewport.x &&
            bounds.y < viewport.y + viewport.height &&
            bounds.y + bounds.height > viewport.y;
          if (!inView) {
            return { x: bounds.x, y: bounds.y, width: 0, height: 0 };
          }
          return {
            x: Math.max(bounds.x, viewport.x),
            y: Math.max(bounds.y, viewport.y),
            width:
              Math.min(bounds.x + bounds.width, viewport.x + viewport.width) -
              Math.max(bounds.x, viewport.x),
            height:
              Math.min(bounds.y + bounds.height, viewport.y + viewport.height) -
              Math.max(bounds.y, viewport.y),
          };
        }) as ComputedRef<ComputedBounds | null>;
        inner.set(key, c);
      }
      return c();
    },

    getCenter(nodeId: NodeId): { x: number; y: number } {
      let c = centerCache.get(nodeId);
      if (!c) {
        c = computed(() => {
          const bounds = engine.getComputedBounds(nodeId);
          return {
            x: bounds.x + bounds.width / 2,
            y: bounds.y + bounds.height / 2,
          };
        }) as ComputedRef<{ x: number; y: number }>;
        centerCache.set(nodeId, c);
      }
      return c();
    },

    getEdge(nodeId: NodeId, edge: Edge): number {
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
      selectors.invalidate(nodeId, "layout");

      // Cascade to all descendants — parent transform change invalidates
      // every child's world transform, bounds, etc.
      const ids = [nodeId, ...selectors.getDescendants(nodeId)];
      for (const id of ids) {
        disposeEntry(worldCache, id);
        disposeEntry(boundsCache, id);
        visibleBoundsCache.delete(id);
        disposeEntry(centerCache, id);
        disposeEntry(localCache, id);
      }
    },

    invalidateAll(): void {
      selectors.invalidateAll();
      clearAll();
    },
  };

  return engine;
}
