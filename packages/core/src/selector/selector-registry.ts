import { createScope, type Signal } from "../deps/reactive-scope.js";
import type { NodeId, SceneGraph, SceneNode } from "../types.js";

type NodeField = "visible" | "layout" | "props" | "children" | "parent";

const MAX_CACHED_SELECTORS = 5000;

interface TreeIndexEntry {
  preorder: number;
  subtreeSize: number;
}

interface SelectorNode<T = unknown> {
  readonly type: string;
  readonly key: string;
  get(): T;
  invalidate(): void;
  dispose(): void;
}

export interface SelectorRegistry {
  getNode(nodeId: NodeId): SceneNode | undefined;
  getNodeUnsafe(nodeId: NodeId): SceneNode;
  getChildren(nodeId: NodeId): SceneNode[];
  getParent(nodeId: NodeId): SceneNode | undefined;
  getRoot(): SceneNode;
  getNodes(nodeIds: NodeId[]): SceneNode[];
  getAllNodes(): SceneNode[];
  getAncestors(nodeId: NodeId): SceneNode[];
  getDescendants(nodeId: NodeId): SceneNode[];
  getSiblings(nodeId: NodeId): SceneNode[];
  getDepth(nodeId: NodeId): number;
  isDescendantOf(nodeId: NodeId, ancestorId: NodeId): boolean;
  getVisibleNodes(): SceneNode[];
  getNodeLayout(nodeId: NodeId): Record<string, unknown> | undefined;
  getNodeProps(nodeId: NodeId): Record<string, unknown> | undefined;
  getNodeVisibility(nodeId: NodeId): boolean | undefined;
  invalidate(nodeId: NodeId, field?: NodeField): void;
  invalidateAll(): void;
  notifyNodeAdded(nodeId: NodeId): void;
  notifyNodeRemoved(nodeId: NodeId): void;
  sync(newScene: SceneGraph): void;
  getVersion(): number;
  batch<T>(fn: () => T): T;
  flush(): void;
  removeSelector(type: string, key: string): boolean;
}

type SelectorType =
  | "children"
  | "parent"
  | "root"
  | "allNodes"
  | "ancestors"
  | "descendants"
  | "siblings"
  | "depth"
  | "visibleNodes"
  | "isDescendantOf"
  | "nodeLayout"
  | "nodeProps"
  | "nodeVisibility";

export function createSelectorRegistry(
  scene: Readonly<SceneGraph>,
): SelectorRegistry {
  const {
    signal,
    computed,
    startBatch,
    endBatch,
    flush: flushScope,
  } = createScope();
  const childrenSignals = new Map<NodeId, Signal<number>>();
  const parentSignals = new Map<NodeId, Signal<number>>();
  const visibleSignals = new Map<NodeId, Signal<number>>();
  const layoutSignals = new Map<NodeId, Signal<number>>();
  const propsSignals = new Map<NodeId, Signal<number>>();
  const nodeExistenceSignal = signal(0);
  const computedCache = new Map<SelectorType, Map<string, SelectorNode>>();
  const accessCounts = new WeakMap<SelectorNode, number>();
  let currentScene = scene;

  // ── Tree Index ──
  // Preorder-flattened node list + subtree size for O(1) descendants.
  // Rebuilt on structural changes before signal bumps.
  const treeIndexSignal = signal(0);
  let flattenedNodes: NodeId[] = [];
  const treeIndex = new Map<NodeId, TreeIndexEntry>();

  function rebuildTreeIndex(): void {
    const result: NodeId[] = [];
    const index = new Map<NodeId, TreeIndexEntry>();

    function walk(id: NodeId): number {
      const node = currentScene.nodes[id];
      if (!node) return 0;
      const preorder = result.length;
      result.push(id);
      let size = 1;
      if (node.children) {
        for (const childId of node.children) {
          size += walk(childId);
        }
      }
      index.set(id, { preorder, subtreeSize: size });
      return size;
    }

    if (currentScene.rootId) {
      walk(currentScene.rootId);
    }

    flattenedNodes = result;
    treeIndex.clear();
    for (const [id, entry] of index) {
      treeIndex.set(id, entry);
    }
    treeIndexSignal(treeIndexSignal() + 1);
  }

  // ── Visibility Index ──
  // Set of visible node IDs for O(visible count) getVisibleNodes.
  const visibilityIndexSignal = signal(0);
  let visibleNodeIds: Set<NodeId> = new Set();

  function rebuildVisibilityIndex(): void {
    const next = new Set<NodeId>();
    for (const [id, node] of Object.entries(currentScene.nodes)) {
      if (node.visible !== false) {
        next.add(id);
      }
    }
    visibleNodeIds = next;
    visibilityIndexSignal(visibilityIndexSignal() + 1);
  }

  // ── Initial index build ──
  rebuildTreeIndex();
  rebuildVisibilityIndex();

  function getSignal(
    map: Map<NodeId, Signal<number>>,
    nodeId: string,
  ): () => number {
    let s = map.get(nodeId);
    if (!s) {
      s = signal(0);
      map.set(nodeId, s);
    }
    return s;
  }

  function bumpSignal(map: Map<NodeId, Signal<number>>, nodeId: string): void {
    const s = map.get(nodeId);
    if (s) s(s() + 1);
  }

  function createNode<T>(
    type: string,
    key: string,
    compute: () => T,
  ): SelectorNode<T> {
    let disposed = false;
    const versionSignal = signal(0);

    const fn = computed(() => {
      versionSignal();
      return compute();
    });

    const node: SelectorNode<T> = {
      type,
      key,
      get(): T {
        if (disposed) {
          throw new Error(`SelectorNode(${type},${key}) has been disposed`);
        }
        const count = (accessCounts.get(node) ?? 0) + 1;
        accessCounts.set(node, count);
        return fn();
      },
      invalidate(): void {
        versionSignal(versionSignal() + 1);
      },
      dispose(): void {
        if (disposed) return;
        disposed = true;
        fn.dispose();
        accessCounts.delete(node);
        const innerMap = computedCache.get(type);
        if (innerMap && innerMap.get(key) === node) {
          innerMap.delete(key);
        }
      },
    };

    accessCounts.set(node, 1);
    return node;
  }

  function bumpExistence(): void {
    nodeExistenceSignal(nodeExistenceSignal() + 1);
  }

  function disposeAll(): void {
    for (const innerMap of computedCache.values()) {
      const nodes = [...innerMap.values()];
      for (const node of nodes) {
        node.dispose();
      }
    }
    computedCache.clear();
  }

  function enforceCacheLimit(): void {
    let total = 0;
    for (const innerMap of computedCache.values()) {
      total += innerMap.size;
    }
    if (total <= MAX_CACHED_SELECTORS) return;

    let minAccess = Infinity;
    let minNode: SelectorNode | null = null;

    for (const innerMap of computedCache.values()) {
      for (const node of innerMap.values()) {
        const count = accessCounts.get(node) ?? 0;
        if (count < minAccess) {
          minAccess = count;
          minNode = node;
        }
      }
    }

    if (minNode) {
      minNode.dispose();
    }
  }

  function getCached<T>(
    type: SelectorType,
    key: string,
    compute: () => T,
  ): SelectorNode<T> {
    let innerMap = computedCache.get(type);
    if (!innerMap) {
      innerMap = new Map();
      computedCache.set(type, innerMap);
    }
    let n = innerMap.get(key) as SelectorNode<T> | undefined;
    if (!n) {
      n = createNode(type, key, compute);
      innerMap.set(key, n);
      enforceCacheLimit();
    }
    return n;
  }

  // Proxy-based auto dependency tracking.
  // Each property access reads the corresponding field signal.
  // Target is an empty object — every getter dynamically reads
  // from currentScene.nodes[nodeId] for a live view that survives sync().
  const proxyCache = new Map<NodeId, SceneNode>();

  function createTrackedNode(nodeId: NodeId): SceneNode | undefined {
    if (!currentScene.nodes[nodeId]) return undefined;

    let proxy = proxyCache.get(nodeId);
    if (proxy) return proxy;

    proxy = new Proxy({} as SceneNode, {
      get(_, prop) {
        const n = currentScene.nodes[nodeId];
        if (!n) return undefined;
        if (prop === "children") {
          getSignal(childrenSignals, nodeId)();
        } else if (prop === "parentId") {
          getSignal(parentSignals, nodeId)();
        } else if (prop === "layout") {
          getSignal(layoutSignals, nodeId)();
        } else if (prop === "props") {
          getSignal(propsSignals, nodeId)();
        } else if (prop === "visible") {
          getSignal(visibleSignals, nodeId)();
        }
        return Reflect.get(n, prop);
      },
    });
    proxyCache.set(nodeId, proxy);
    return proxy;
  }

  const registry: SelectorRegistry = {
    getNode(nodeId: NodeId): SceneNode | undefined {
      return createTrackedNode(nodeId);
    },

    getNodeUnsafe(nodeId: NodeId): SceneNode {
      const node = registry.getNode(nodeId);
      if (!node) {
        throw new Error(`Node "${nodeId}" not found in scene`);
      }
      return node;
    },

    getChildren(nodeId: NodeId): SceneNode[] {
      return getCached("children", nodeId, () => {
        const node = registry.getNode(nodeId);
        if (!node?.children) return [];
        const result: SceneNode[] = [];
        for (const childId of node.children) {
          const child = registry.getNode(childId);
          if (child) result.push(child);
        }
        return result;
      }).get();
    },

    getParent(nodeId: NodeId): SceneNode | undefined {
      return getCached("parent", nodeId, () => {
        const node = registry.getNode(nodeId);
        return node?.parentId ? registry.getNode(node.parentId) : undefined;
      }).get();
    },

    getRoot(): SceneNode {
      return getCached("root", "root", () => {
        const root = registry.getNode(currentScene.rootId);
        if (!root) {
          throw new Error(`Root node "${currentScene.rootId}" not found`);
        }
        return root;
      }).get();
    },

    getNodes(nodeIds: NodeId[]): SceneNode[] {
      for (const id of nodeIds) {
        getSignal(childrenSignals, id)();
      }
      return nodeIds
        .map((id) => currentScene.nodes[id])
        .filter((n): n is SceneNode => n !== undefined);
    },

    getAllNodes(): SceneNode[] {
      return getCached("allNodes", "all", () => {
        nodeExistenceSignal();
        return Object.values(currentScene.nodes);
      }).get();
    },

    getAncestors(nodeId: NodeId): SceneNode[] {
      return getCached("ancestors", nodeId, () => {
        getSignal(parentSignals, nodeId)();
        const ancestors: SceneNode[] = [];
        let currentId = currentScene.nodes[nodeId]?.parentId;
        while (currentId) {
          const parent = registry.getNode(currentId);
          if (!parent) break;
          ancestors.push(parent);
          currentId = parent.parentId;
        }
        return ancestors;
      }).get();
    },

    getDescendants(nodeId: NodeId): SceneNode[] {
      return getCached("descendants", nodeId, () => {
        getSignal(childrenSignals, nodeId)();
        treeIndexSignal();
        const entry = treeIndex.get(nodeId);
        if (!entry) return [];
        const ids = flattenedNodes.slice(
          entry.preorder + 1,
          entry.preorder + entry.subtreeSize,
        );
        return ids
          .map((id) => currentScene.nodes[id])
          .filter((n): n is SceneNode => n !== undefined);
      }).get();
    },

    getSiblings(nodeId: NodeId): SceneNode[] {
      return getCached("siblings", nodeId, () => {
        const node = registry.getNode(nodeId);
        if (!node?.parentId) return [];
        const parent = registry.getNode(node.parentId);
        if (!parent) return [];
        return (parent.children ?? [])
          .filter((id) => id !== nodeId)
          .map((id) => registry.getNode(id))
          .filter((n): n is SceneNode => n !== undefined);
      }).get();
    },

    getDepth(nodeId: NodeId): number {
      return getCached("depth", nodeId, () => {
        getSignal(parentSignals, nodeId)();
        let depth = 0;
        let currentId = currentScene.nodes[nodeId]?.parentId;
        while (currentId) {
          depth++;
          const parent = registry.getNode(currentId);
          currentId = parent?.parentId;
        }
        return depth;
      }).get();
    },

    isDescendantOf(nodeId: NodeId, ancestorId: NodeId): boolean {
      return getCached("isDescendantOf", `${nodeId}:${ancestorId}`, () => {
        const ancestors = registry.getAncestors(nodeId);
        return ancestors.some((a) => a.id === ancestorId);
      }).get();
    },

    getVisibleNodes(): SceneNode[] {
      return getCached("visibleNodes", "all", () => {
        nodeExistenceSignal();
        for (const id of visibleNodeIds) {
          getSignal(visibleSignals, id)();
        }
        return [...visibleNodeIds]
          .map((id) => currentScene.nodes[id])
          .filter((n): n is SceneNode => n !== undefined);
      }).get();
    },

    getNodeLayout(nodeId: NodeId): Record<string, unknown> | undefined {
      return getCached("nodeLayout", nodeId, () => {
        getSignal(layoutSignals, nodeId)();
        return currentScene.nodes[nodeId]?.layout;
      }).get();
    },

    getNodeProps(nodeId: NodeId): Record<string, unknown> | undefined {
      return getCached("nodeProps", nodeId, () => {
        getSignal(propsSignals, nodeId)();
        return currentScene.nodes[nodeId]?.props;
      }).get();
    },

    getNodeVisibility(nodeId: NodeId): boolean | undefined {
      return getCached("nodeVisibility", nodeId, () => {
        getSignal(visibleSignals, nodeId)();
        return currentScene.nodes[nodeId]?.visible;
      }).get();
    },

    invalidate(nodeId: NodeId, field?: NodeField): void {
      const isStructural = !field || field === "children" || field === "parent";
      if (isStructural) {
        rebuildTreeIndex();
      }
      if (!field || field === "visible") {
        rebuildVisibilityIndex();
      }

      if (!field) {
        bumpSignal(childrenSignals, nodeId);
        bumpSignal(parentSignals, nodeId);
        bumpSignal(visibleSignals, nodeId);
        bumpSignal(layoutSignals, nodeId);
        bumpSignal(propsSignals, nodeId);
        bumpExistence();
        return;
      }
      if (field === "children") {
        bumpSignal(childrenSignals, nodeId);
      } else if (field === "parent") {
        bumpSignal(parentSignals, nodeId);
      } else if (field === "visible") {
        bumpSignal(visibleSignals, nodeId);
      } else if (field === "layout") {
        bumpSignal(layoutSignals, nodeId);
      } else if (field === "props") {
        bumpSignal(propsSignals, nodeId);
      }
    },

    notifyNodeAdded(nodeId: NodeId): void {
      rebuildTreeIndex();
      rebuildVisibilityIndex();
      bumpSignal(childrenSignals, nodeId);
      bumpSignal(parentSignals, nodeId);
      bumpExistence();
    },

    notifyNodeRemoved(nodeId: NodeId): void {
      rebuildTreeIndex();
      rebuildVisibilityIndex();
      bumpSignal(childrenSignals, nodeId);
      bumpSignal(parentSignals, nodeId);
      bumpExistence();
    },

    invalidateAll(): void {
      for (const innerMap of computedCache.values()) {
        for (const node of innerMap.values()) {
          node.invalidate();
        }
      }
      bumpExistence();
    },

    sync(newScene: SceneGraph): void {
      currentScene = newScene;
      childrenSignals.clear();
      parentSignals.clear();
      visibleSignals.clear();
      layoutSignals.clear();
      propsSignals.clear();
      proxyCache.clear();
      disposeAll();
      rebuildTreeIndex();
      rebuildVisibilityIndex();
      bumpExistence();
    },

    getVersion(): number {
      return currentScene.version;
    },

    batch<T>(fn: () => T): T {
      startBatch();
      try {
        return fn();
      } finally {
        endBatch();
      }
    },

    flush(): void {
      flushScope();
    },

    removeSelector(type: string, key: string): boolean {
      const innerMap = computedCache.get(type);
      if (!innerMap) return false;
      const node = innerMap.get(key);
      if (!node) return false;
      node.dispose();
      return true;
    },
  };

  return registry;
}
