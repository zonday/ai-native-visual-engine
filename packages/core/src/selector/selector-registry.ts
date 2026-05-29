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
  ref(): void;
  unref(): void;
  get(): T;
  invalidate(): void;
  dispose(): void;
}

export type ScenePatch =
  | { type: "set-prop"; nodeId: NodeId; field: NodeField; value: unknown }
  | { type: "reparent"; nodeId: NodeId; oldParent?: NodeId; newParent: NodeId }
  | { type: "add-node"; nodeId: NodeId; node: SceneNode }
  | { type: "remove-node"; nodeId: NodeId };

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
  applyPatch(patch: ScenePatch): void;
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

  // ── Indexes ──
  const treeIndexSignal = signal(0);
  let flattenedNodes: NodeId[] = [];
  const treeIndex = new Map<NodeId, TreeIndexEntry>();
  let treeIndexDirty = false;
  const descResultCache = new Map<NodeId, SceneNode[]>();

  const visibilityIndexSignal = signal(0);
  let visibleNodeIds: Set<NodeId> = new Set();
  let visibilityIndexDirty = false;

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
    descResultCache.clear();
  }

  function ensureTreeIndex(): void {
    if (!treeIndexDirty) return;
    treeIndexDirty = false;
    rebuildTreeIndex();
  }

  function markTreeIndexDirty(): void {
    if (treeIndexDirty) return;
    treeIndexDirty = true;
    treeIndexSignal(treeIndexSignal() + 1);
  }

  function rebuildVisibilityIndex(): void {
    const next = new Set<NodeId>();
    for (const [id, node] of Object.entries(currentScene.nodes)) {
      if (node.visible !== false) {
        next.add(id);
      }
    }
    visibleNodeIds = next;
  }

  function ensureVisibilityIndex(): void {
    if (!visibilityIndexDirty) return;
    visibilityIndexDirty = false;
    rebuildVisibilityIndex();
  }

  function markVisibilityIndexDirty(): void {
    if (visibilityIndexDirty) return;
    visibilityIndexDirty = true;
    visibilityIndexSignal(visibilityIndexSignal() + 1);
  }

  rebuildTreeIndex();
  rebuildVisibilityIndex();

  // ── Signal helpers ──
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

  // ── Explicit dependency tracking ──
  // Each selector explicitly declares which fields it reads.
  // No proxy — every dependency is visible in the compute function.
  function trackChildren(nodeId: NodeId): void {
    getSignal(childrenSignals, nodeId)();
  }

  function trackParent(nodeId: NodeId): void {
    getSignal(parentSignals, nodeId)();
  }

  function trackLayout(nodeId: NodeId): void {
    getSignal(layoutSignals, nodeId)();
  }

  function trackProps(nodeId: NodeId): void {
    getSignal(propsSignals, nodeId)();
  }

  function trackVisibility(nodeId: NodeId): void {
    getSignal(visibleSignals, nodeId)();
  }

  // ── SelectorNode ──
  function createNode<T>(
    type: string,
    key: string,
    compute: () => T,
  ): SelectorNode<T> {
    let disposed = false;
    let refCount = 0;
    const versionSignal = signal(0);

    const fn = computed(() => {
      versionSignal();
      return compute();
    });

    function tryDispose(): void {
      if (disposed) return;
      if (refCount > 0) return;
      disposed = true;
      fn.dispose();
      accessCounts.delete(node);
      const innerMap = computedCache.get(type);
      if (innerMap && innerMap.get(key) === node) {
        innerMap.delete(key);
      }
    }

    const node: SelectorNode<T> = {
      type,
      key,
      ref(): void {
        refCount++;
      },
      unref(): void {
        if (refCount > 0) refCount--;
        tryDispose();
      },
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
        refCount = 0;
        tryDispose();
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

    // Decay all access counts before comparison to prevent old
    // high-count entries from dominating cache permanently.
    for (const innerMap of computedCache.values()) {
      for (const node of innerMap.values()) {
        const count = accessCounts.get(node) ?? 1;
        accessCounts.set(node, Math.max(Math.floor(count / 2), 1));
      }
    }

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

    if (minNode) minNode.dispose();
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

  // ── Patch Apply (owns both scene mutation and signal bump) ──
  // Always creates new node objects — never mutates originals.
  // This preserves Readonly<SceneGraph> semantics and prevents
  // external code from bypassing invalidation via stale references.
  function handlePatch(patch: ScenePatch): void {
    if (patch.type === "set-prop") {
      const { nodeId, field } = patch;
      const node = currentScene.nodes[nodeId];
      if (!node) return;
      const key = field === "parent" ? "parentId" : field;
      currentScene.nodes[nodeId] = { ...node, [key]: patch.value };
      if (field === "visible") markVisibilityIndexDirty();
      if (field === "children" || field === "parent") markTreeIndexDirty();
      bumpSignal(
        field === "children"
          ? childrenSignals
          : field === "parent"
            ? parentSignals
            : field === "visible"
              ? visibleSignals
              : field === "layout"
                ? layoutSignals
                : propsSignals,
        nodeId,
      );
    } else if (patch.type === "reparent") {
      const { nodeId, oldParent, newParent } = patch;
      const node = currentScene.nodes[nodeId];
      const newP = currentScene.nodes[newParent];
      if (!node || !newP) return;
      // Atomically update parentId + both parents' children
      currentScene.nodes[nodeId] = { ...node, parentId: newParent };
      const oldP = oldParent ? currentScene.nodes[oldParent] : undefined;
      if (oldP?.children) {
        currentScene.nodes[oldParent!] = {
          ...oldP,
          children: oldP.children.filter((id) => id !== nodeId),
        };
      }
      currentScene.nodes[newParent] = {
        ...newP,
        children: [...(newP.children ?? []), nodeId],
      };
      markTreeIndexDirty();
      bumpSignal(parentSignals, nodeId);
      if (oldParent) bumpSignal(childrenSignals, oldParent);
      bumpSignal(childrenSignals, newParent);
    } else if (patch.type === "add-node") {
      currentScene.nodes[patch.nodeId] = patch.node;
      markTreeIndexDirty();
      markVisibilityIndexDirty();
      bumpExistence();
    } else if (patch.type === "remove-node") {
      delete currentScene.nodes[patch.nodeId];
      markTreeIndexDirty();
      markVisibilityIndexDirty();
      bumpExistence();
    }
  }

  const registry: SelectorRegistry = {
    // getNode returns the raw node — no proxy. Callers must explicitly
    // declare field dependencies via trackChildren / trackParent / etc.
    getNode(nodeId: NodeId): SceneNode | undefined {
      return currentScene.nodes[nodeId];
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
        trackChildren(nodeId);
        const node = currentScene.nodes[nodeId];
        if (!node?.children) return [];
        const result: SceneNode[] = [];
        for (const childId of node.children) {
          const child = currentScene.nodes[childId];
          if (child) result.push(child);
        }
        return result;
      }).get();
    },

    getParent(nodeId: NodeId): SceneNode | undefined {
      return getCached("parent", nodeId, () => {
        trackParent(nodeId);
        const node = currentScene.nodes[nodeId];
        return node?.parentId ? currentScene.nodes[node.parentId] : undefined;
      }).get();
    },

    getRoot(): SceneNode {
      return getCached("root", "root", () => {
        nodeExistenceSignal();
        const root = currentScene.nodes[currentScene.rootId];
        if (!root) {
          throw new Error(`Root node "${currentScene.rootId}" not found`);
        }
        return root;
      }).get();
    },

    getNodes(nodeIds: NodeId[]): SceneNode[] {
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
        trackParent(nodeId);
        const ancestors: SceneNode[] = [];
        let currentId = currentScene.nodes[nodeId]?.parentId;
        while (currentId) {
          const parent = currentScene.nodes[currentId];
          if (!parent) break;
          ancestors.push(parent);
          currentId = parent.parentId;
        }
        return ancestors;
      }).get();
    },

    getDescendants(nodeId: NodeId): SceneNode[] {
      return getCached("descendants", nodeId, () => {
        trackChildren(nodeId);
        ensureTreeIndex();
        treeIndexSignal();
        const entry = treeIndex.get(nodeId);
        if (!entry) return [];
        const ids = flattenedNodes.slice(
          entry.preorder + 1,
          entry.preorder + entry.subtreeSize,
        );
        const prev = descResultCache.get(nodeId);
        const same =
          prev &&
          prev.length === ids.length &&
          prev.every((n, i) => n && n.id === ids[i]);
        if (same && prev) return prev;
        const result = ids
          .map((id) => currentScene.nodes[id])
          .filter((n): n is SceneNode => n !== undefined);
        descResultCache.set(nodeId, result);
        return result;
      }).get();
    },

    getSiblings(nodeId: NodeId): SceneNode[] {
      return getCached("siblings", nodeId, () => {
        trackParent(nodeId);
        const node = currentScene.nodes[nodeId];
        if (!node?.parentId) return [];
        trackChildren(node.parentId);
        const parent = currentScene.nodes[node.parentId];
        if (!parent) return [];
        return (parent.children ?? [])
          .filter((id) => id !== nodeId)
          .map((id) => currentScene.nodes[id])
          .filter((n): n is SceneNode => n !== undefined);
      }).get();
    },

    getDepth(nodeId: NodeId): number {
      return getCached("depth", nodeId, () => {
        trackParent(nodeId);
        let depth = 0;
        let currentId = currentScene.nodes[nodeId]?.parentId;
        while (currentId) {
          depth++;
          const parent = currentScene.nodes[currentId];
          currentId = parent?.parentId;
        }
        return depth;
      }).get();
    },

    isDescendantOf(nodeId: NodeId, ancestorId: NodeId): boolean {
      if (nodeId === ancestorId) return false;
      return getCached("isDescendantOf", `${nodeId}:${ancestorId}`, () => {
        trackParent(nodeId);
        ensureTreeIndex();
        treeIndexSignal();
        const anc = treeIndex.get(ancestorId);
        const desc = treeIndex.get(nodeId);
        if (!anc || !desc) return false;
        return (
          anc.preorder <= desc.preorder &&
          desc.preorder < anc.preorder + anc.subtreeSize
        );
      }).get();
    },

    getVisibleNodes(): SceneNode[] {
      return getCached("visibleNodes", "all", () => {
        nodeExistenceSignal();
        ensureVisibilityIndex();
        visibilityIndexSignal();
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
        trackLayout(nodeId);
        return currentScene.nodes[nodeId]?.layout;
      }).get();
    },

    getNodeProps(nodeId: NodeId): Record<string, unknown> | undefined {
      return getCached("nodeProps", nodeId, () => {
        trackProps(nodeId);
        return currentScene.nodes[nodeId]?.props;
      }).get();
    },

    getNodeVisibility(nodeId: NodeId): boolean | undefined {
      return getCached("nodeVisibility", nodeId, () => {
        trackVisibility(nodeId);
        return currentScene.nodes[nodeId]?.visible;
      }).get();
    },

    invalidate(nodeId: NodeId, field?: NodeField): void {
      const isStructural = !field || field === "children" || field === "parent";
      if (isStructural) markTreeIndexDirty();
      if (!field || field === "visible") markVisibilityIndexDirty();

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
      markTreeIndexDirty();
      markVisibilityIndexDirty();
      bumpSignal(childrenSignals, nodeId);
      bumpSignal(parentSignals, nodeId);
      bumpExistence();
    },

    notifyNodeRemoved(nodeId: NodeId): void {
      markTreeIndexDirty();
      markVisibilityIndexDirty();
      bumpSignal(childrenSignals, nodeId);
      bumpSignal(parentSignals, nodeId);
      bumpExistence();
    },

    applyPatch(patch: ScenePatch): void {
      handlePatch(patch);
    },

    invalidateAll(): void {
      if (
        typeof process !== "undefined" &&
        process.env?.NODE_ENV !== "production"
      ) {
        console.warn(
          "[selector-registry] invalidateAll() degrades incremental architecture",
        );
      }
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
      disposeAll();
      rebuildTreeIndex();
      treeIndexDirty = false;
      rebuildVisibilityIndex();
      visibilityIndexDirty = false;
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
