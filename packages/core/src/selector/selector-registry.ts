import { createScope, type Signal } from "../deps/reactive-scope.js";
import type { NodeId, SceneGraph, SceneNode } from "../types.js";

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
  invalidate(nodeId: NodeId): void;
  invalidateAll(): void;
  sync(newScene: SceneGraph): void;
  getVersion(): number;
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
  | "visibleNodes";

export function createSelectorRegistry(
  scene: Readonly<SceneGraph>,
): SelectorRegistry {
  const { signal, computed } = createScope();
  const versionSignals = new Map<NodeId, Signal<number>>();
  const computedCache = new Map<SelectorType, Map<string, () => unknown>>();
  let syncedVersion = scene.version;

  function getVersionSignal(nodeId: string): () => number {
    let s = versionSignals.get(nodeId);
    if (!s) {
      s = signal(0);
      versionSignals.set(nodeId, s);
    }
    return s;
  }

  function bumpAllVersionSignals(): void {
    for (const [, s] of versionSignals) {
      s(s() + 1);
    }
  }

  function checkVersion(): void {
    if (scene.version !== syncedVersion) {
      // Scene was fully replaced (undo/redo/sync): all node references changed.
      // Wipe everything — old version signals point to stale scene nodes,
      // and old computed values close over the replaced scene reference.
      versionSignals.clear();
      computedCache.clear();
      syncedVersion = scene.version;
    }
  }

  function getCached<T>(
    type: SelectorType,
    key: string,
    compute: () => T,
  ): () => T {
    let innerMap = computedCache.get(type);
    if (!innerMap) {
      innerMap = new Map();
      computedCache.set(type, innerMap);
    }
    let c = innerMap.get(key) as (() => T) | undefined;
    if (!c) {
      c = computed(compute) as () => T;
      innerMap.set(key, c);
    }
    return c;
  }

  const registry: SelectorRegistry = {
    getNode(nodeId: NodeId): SceneNode | undefined {
      checkVersion();
      getVersionSignal(nodeId)();
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
        getVersionSignal(nodeId)();
        const node = scene.nodes[nodeId];
        if (!node?.children) return [];
        const result: SceneNode[] = [];
        for (const childId of node.children) {
          const child = registry.getNode(childId);
          if (child) result.push(child);
        }
        return result;
      })();
    },

    getParent(nodeId: NodeId): SceneNode | undefined {
      checkVersion();
      return getCached("parent", nodeId, () => {
        getVersionSignal(nodeId)();
        const node = scene.nodes[nodeId];
        return node?.parentId ? registry.getNode(node.parentId) : undefined;
      })();
    },

    getRoot(): SceneNode {
      checkVersion();
      return getCached("root", "root", () => {
        getVersionSignal(scene.rootId)();
        const root = scene.nodes[scene.rootId];
        if (!root) {
          throw new Error(`Root node "${scene.rootId}" not found`);
        }
        return root;
      })();
    },

    getNodes(nodeIds: NodeId[]): SceneNode[] {
      checkVersion();
      for (const id of nodeIds) {
        getVersionSignal(id)();
      }
      return nodeIds
        .map((id) => scene.nodes[id])
        .filter((n): n is SceneNode => n !== undefined);
    },

    getAllNodes(): SceneNode[] {
      checkVersion();
      return getCached("allNodes", "all", () => Object.values(scene.nodes))();
    },

    getAncestors(nodeId: NodeId): SceneNode[] {
      checkVersion();
      return getCached("ancestors", nodeId, () => {
        getVersionSignal(nodeId)();
        const ancestors: SceneNode[] = [];
        let current = scene.nodes[nodeId]?.parentId;
        while (current) {
          const parent = registry.getNode(current);
          if (!parent) break;
          ancestors.push(parent);
          current = parent.parentId;
        }
        return ancestors;
      })();
    },

    getDescendants(nodeId: NodeId): SceneNode[] {
      checkVersion();
      return getCached("descendants", nodeId, () => {
        getVersionSignal(nodeId)();
        const descendants: SceneNode[] = [];
        function walk(id: string, depth: number = 0): void {
          // Depth limit is defense-in-depth: mutation layer MUST prevent cycles,
          // but a safety guard prevents stack overflow on corrupted data.
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
      })();
    },

    getSiblings(nodeId: NodeId): SceneNode[] {
      checkVersion();
      return getCached("siblings", nodeId, () => {
        getVersionSignal(nodeId)();
        const node = scene.nodes[nodeId];
        if (!node?.parentId) return [];
        const parent = registry.getNode(node.parentId);
        if (!parent) return [];
        return (parent.children ?? [])
          .filter((id) => id !== nodeId)
          .map((id) => registry.getNode(id))
          .filter((n): n is SceneNode => n !== undefined);
      })();
    },

    getDepth(nodeId: NodeId): number {
      checkVersion();
      return getCached("depth", nodeId, () => {
        getVersionSignal(nodeId)();
        let depth = 0;
        let current = scene.nodes[nodeId]?.parentId;
        while (current) {
          depth++;
          const parent = registry.getNode(current);
          current = parent?.parentId;
        }
        return depth;
      })();
    },

    isDescendantOf(nodeId: NodeId, ancestorId: NodeId): boolean {
      checkVersion();
      const ancestors = registry.getAncestors(nodeId);
      return ancestors.some((a) => a.id === ancestorId);
    },

    getVisibleNodes(): SceneNode[] {
      checkVersion();
      return getCached("visibleNodes", "all", () => {
        // Register dependencies on previously-accessed nodes without
        // creating new signals for unseen nodes (avoids the global-
        // dependency perf trap the reviewer flagged). Full refresh is
        // guaranteed by checkVersion() on scene version change.
        for (const id of Object.keys(scene.nodes)) {
          const s = versionSignals.get(id);
          if (s) s();
        }
        return Object.values(scene.nodes).filter(
          (node) => node.visible !== false,
        );
      })();
    },

    invalidate(nodeId: NodeId): void {
      const s = versionSignals.get(nodeId);
      if (s) {
        s(s() + 1);
      }
    },

    invalidateAll(): void {
      // Incremental: bump version signals so all dependent computeds are
      // marked dirty by the reactive scope. The computedCache survives —
      // entries are lazily re-evaluated when accessed.
      bumpAllVersionSignals();
    },

    sync(newScene: SceneGraph): void {
      // HAZARD: `scene` is a mutable captured reference. Computed closures
      // that read `scene.nodes` during evaluation may see inconsistent state
      // if `sync()` is called while a computed is mid-evaluation. Currently
      // safe because JS is single-threaded and sync() is called outside the
      // reactive flush cycle, but this WILL break with async selectors /
      // worker rendering. Future: sceneSignal = signal(newScene).
      scene = newScene;
      versionSignals.clear();
      computedCache.clear();
      syncedVersion = newScene.version;
    },

    getVersion(): number {
      return scene.version;
    },
  };

  return registry;
}
