import { createScope, type Signal } from "../deps/reactive-scope.js";
import type { NodeId, SceneGraph, SceneNode } from "../types.js";

type NodeField = "structural" | "visible" | "layout" | "props";

interface SelectorNode<T = unknown> {
  readonly type: string;
  readonly key: string;
  deps: Set<SelectorNode>;
  subs: Set<SelectorNode>;
  version: number;
  get(): T;
  bumpVersion(): void;
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
  invalidate(nodeId: NodeId, field?: NodeField): void;
  invalidateAll(): void;
  sync(newScene: SceneGraph): void;
  getVersion(): number;

  // Scheduler
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
  | "isDescendantOf";

export function createSelectorRegistry(
  scene: Readonly<SceneGraph>,
): SelectorRegistry {
  const { signal, computed } = createScope();
  const structuralSignals = new Map<NodeId, Signal<number>>();
  const visibleSignals = new Map<NodeId, Signal<number>>();
  const sceneStructureSignal = signal(0);
  const globalEpoch = signal(0);
  const computedCache = new Map<SelectorType, Map<string, SelectorNode>>();
  let syncedVersion = scene.version;
  const dirtyNodes = new Set<SelectorNode>();
  let batchDepth = 0;
  let isFlushing = false;

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

  function enqueueDirty(node: SelectorNode): void {
    dirtyNodes.add(node);
    if (batchDepth === 0 && !isFlushing) {
      flushScheduler();
    }
  }

  function flushScheduler(): void {
    if (isFlushing) return;
    isFlushing = true;
    try {
      // Reactivity (dependency tracking, dirty marking, lazy recompute)
      // is handled by alien-signals at the signal level. The scheduler
      // is a coordination scope (batch/transaction boundary, dirty-track
      // for cache management). SelectorNode-level propagation through
      // deps/subs is reserved for future non-signal-backed graph edges.
      dirtyNodes.clear();
    } finally {
      isFlushing = false;
    }
  }

  let activeSelector: SelectorNode | null = null;

  function createNode<T>(
    type: string,
    key: string,
    compute: () => T,
  ): SelectorNode<T> {
    const versionSignal = signal(0);
    const deps = new Set<SelectorNode>();
    const subs = new Set<SelectorNode>();
    let disposed = false;

    const fn = computed(() => {
      globalEpoch();
      versionSignal();
      for (const dep of deps) {
        dep.subs.delete(node);
      }
      deps.clear();
      return compute();
    });

    const node: SelectorNode<T> = {
      type,
      key,
      deps,
      subs,
      get version() {
        return versionSignal();
      },
      get(): T {
        if (disposed) {
          throw new Error(`SelectorNode(${type},${key}) has been disposed`);
        }
        if (activeSelector && activeSelector !== node) {
          activeSelector.deps.add(node);
          subs.add(activeSelector);
        }
        const prev = activeSelector;
        activeSelector = node;
        try {
          return fn();
        } finally {
          activeSelector = prev;
        }
      },
      bumpVersion(): void {
        versionSignal(versionSignal() + 1);
      },
      invalidate(): void {
        // Reserved for future use — signal-level invalidation
        // (registry.invalidate) bypasses SelectorNode.invalidate().
        // This path exists for non-signal-backed graph edges.
        node.bumpVersion();
        enqueueDirty(node);
      },
      dispose(): void {
        if (disposed) return;
        disposed = true;
        for (const dep of deps) {
          dep.subs.delete(node);
        }
        for (const sub of subs) {
          sub.deps.delete(node);
        }
        deps.clear();
        subs.clear();
        const innerMap = computedCache.get(type);
        if (innerMap && innerMap.get(key) === node) {
          innerMap.delete(key);
        }
      },
    };

    return node;
  }

  function bumpSceneStructure(): void {
    sceneStructureSignal(sceneStructureSignal() + 1);
  }

  function checkVersion(): void {
    if (scene.version !== syncedVersion) {
      structuralSignals.clear();
      visibleSignals.clear();
      computedCache.clear();
      dirtyNodes.clear();
      syncedVersion = scene.version;
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
    }
    return n;
  }

  function readStructural(nodeId: string): void {
    getSignal(structuralSignals, nodeId)();
  }

  function readVisible(nodeId: string): void {
    getSignal(visibleSignals, nodeId)();
  }

  const registry: SelectorRegistry = {
    getNode(nodeId: NodeId): SceneNode | undefined {
      checkVersion();
      readStructural(nodeId);
      return scene.nodes[nodeId];
    },

    getNodeUnsafe(nodeId: NodeId): SceneNode {
      const node = registry.getNode(nodeId);
      if (!node) {
        throw new Error(`Node "${nodeId}" not found in scene`);
      }
      return node;
    },

    getChildren(nodeId: NodeId): SceneNode[] {
      checkVersion();
      return getCached("children", nodeId, () => {
        readStructural(nodeId);
        const node = scene.nodes[nodeId];
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
      checkVersion();
      return getCached("parent", nodeId, () => {
        readStructural(nodeId);
        const node = scene.nodes[nodeId];
        return node?.parentId ? registry.getNode(node.parentId) : undefined;
      }).get();
    },

    getRoot(): SceneNode {
      checkVersion();
      return getCached("root", "root", () => {
        readStructural(scene.rootId);
        const root = scene.nodes[scene.rootId];
        if (!root) {
          throw new Error(`Root node "${scene.rootId}" not found`);
        }
        return root;
      }).get();
    },

    getNodes(nodeIds: NodeId[]): SceneNode[] {
      checkVersion();
      for (const id of nodeIds) {
        readStructural(id);
      }
      return nodeIds
        .map((id) => scene.nodes[id])
        .filter((n): n is SceneNode => n !== undefined);
    },

    getAllNodes(): SceneNode[] {
      checkVersion();
      return getCached("allNodes", "all", () => {
        sceneStructureSignal();
        return Object.values(scene.nodes);
      }).get();
    },

    getAncestors(nodeId: NodeId): SceneNode[] {
      checkVersion();
      return getCached("ancestors", nodeId, () => {
        readStructural(nodeId);
        const ancestors: SceneNode[] = [];
        let current = scene.nodes[nodeId]?.parentId;
        while (current) {
          const parent = registry.getNode(current);
          if (!parent) break;
          ancestors.push(parent);
          current = parent.parentId;
        }
        return ancestors;
      }).get();
    },

    getDescendants(nodeId: NodeId): SceneNode[] {
      checkVersion();
      return getCached("descendants", nodeId, () => {
        readStructural(nodeId);
        const descendants: SceneNode[] = [];
        function walk(id: string, depth: number = 0): void {
          if (depth > 1000) return;
          const node = scene.nodes[id];
          if (!node?.children) return;
          for (const childId of node.children) {
            const child = registry.getNode(childId);
            if (child) {
              descendants.push(child);
              walk(childId, depth + 1);
            }
          }
        }
        walk(nodeId, 0);
        return descendants;
      }).get();
    },

    getSiblings(nodeId: NodeId): SceneNode[] {
      checkVersion();
      return getCached("siblings", nodeId, () => {
        readStructural(nodeId);
        const node = scene.nodes[nodeId];
        if (!node?.parentId) return [];
        readStructural(node.parentId);
        const parent = registry.getNode(node.parentId);
        if (!parent) return [];
        return (parent.children ?? [])
          .filter((id) => id !== nodeId)
          .map((id) => registry.getNode(id))
          .filter((n): n is SceneNode => n !== undefined);
      }).get();
    },

    getDepth(nodeId: NodeId): number {
      checkVersion();
      return getCached("depth", nodeId, () => {
        readStructural(nodeId);
        let depth = 0;
        let current = scene.nodes[nodeId]?.parentId;
        while (current) {
          depth++;
          const parent = registry.getNode(current);
          current = parent?.parentId;
        }
        return depth;
      }).get();
    },

    isDescendantOf(nodeId: NodeId, ancestorId: NodeId): boolean {
      checkVersion();
      return getCached("isDescendantOf", `${nodeId}:${ancestorId}`, () => {
        const ancestors = registry.getAncestors(nodeId);
        return ancestors.some((a) => a.id === ancestorId);
      }).get();
    },

    getVisibleNodes(): SceneNode[] {
      checkVersion();
      return getCached("visibleNodes", "all", () => {
        for (const id of Object.keys(scene.nodes)) {
          readVisible(id);
        }
        return Object.values(scene.nodes).filter(
          (node) => node.visible !== false,
        );
      }).get();
    },

    invalidate(nodeId: NodeId, field?: NodeField): void {
      if (!field) {
        bumpSignal(structuralSignals, nodeId);
        bumpSignal(visibleSignals, nodeId);
        bumpSceneStructure();
        return;
      }
      if (field === "structural") {
        bumpSignal(structuralSignals, nodeId);
        bumpSceneStructure();
      } else if (field === "visible") {
        bumpSignal(visibleSignals, nodeId);
      } else if (field === "layout") {
        bumpSignal(structuralSignals, nodeId);
        bumpSceneStructure();
      } else if (field === "props") {
        bumpSignal(structuralSignals, nodeId);
        bumpSceneStructure();
      }
    },

    invalidateAll(): void {
      globalEpoch(globalEpoch() + 1);
      bumpSceneStructure();
    },

    sync(newScene: SceneGraph): void {
      scene = newScene;
      structuralSignals.clear();
      visibleSignals.clear();
      computedCache.clear();
      dirtyNodes.clear();
      bumpSceneStructure();
      syncedVersion = newScene.version;
    },

    getVersion(): number {
      return scene.version;
    },

    batch<T>(fn: () => T): T {
      batchDepth++;
      try {
        return fn();
      } finally {
        batchDepth--;
        if (batchDepth === 0) {
          flushScheduler();
        }
      }
    },

    flush(): void {
      flushScheduler();
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
