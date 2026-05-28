import type { NodeId, SceneGraph, SceneNode } from "../types.js";
import { DependencyGraph } from "../deps/dependency-graph.js";

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

function createNodeCache() {
  const cache = new Map<string, { sceneVersion: number; value: unknown }>();
  return {
    get<T>(key: string, sceneVersion: number): T | undefined {
      const entry = cache.get(key);
      if (entry && entry.sceneVersion === sceneVersion) {
        return entry.value as T;
      }
      return undefined;
    },
    set<T>(key: string, sceneVersion: number, value: T): void {
      cache.set(key, { sceneVersion, value });
    },
    delete(key: string): void {
      cache.delete(key);
    },
    forEach(fn: (key: string) => void): void {
      for (const key of cache.keys()) {
        fn(key);
      }
    },
    clear(): void {
      cache.clear();
    },
  };
}

export function createSelectorRegistry(scene: SceneGraph): SelectorRegistry {
  const nodeCache = createNodeCache();
  const listCache = createNodeCache();
  const graph = new DependencyGraph();
  let syncedVersion = scene.version;
  let currentDependent: string | null = null;

  function checkVersion(): void {
    if (scene.version !== syncedVersion) {
      nodeCache.clear();
      listCache.clear();
      graph.clear();
      syncedVersion = scene.version;
    }
  }

  function trackRead(source: string): void {
    if (currentDependent) {
      graph.addDependency(source, currentDependent);
    }
  }

  function cacheNode<T>(key: string, fn: () => T): T {
    const cached = nodeCache.get<T>(key, syncedVersion);
    if (cached !== undefined) return cached;
    const prevDependent = currentDependent;
    currentDependent = key;
    const value = fn();
    currentDependent = prevDependent;
    nodeCache.set(key, syncedVersion, value);
    return value;
  }

  function cacheList<T>(key: string, fn: () => T): T {
    const cached = listCache.get<T>(key, syncedVersion);
    if (cached !== undefined) return cached;
    const prevDependent = currentDependent;
    currentDependent = key;
    const value = fn();
    currentDependent = prevDependent;
    listCache.set(key, syncedVersion, value);
    return value;
  }

  function clearCacheKey(key: string): void {
    nodeCache.delete(key);
    listCache.delete(key);
    graph.removeDependent(key);
  }

  const registry: SelectorRegistry = {
    getNode(nodeId: NodeId): SceneNode | undefined {
      checkVersion();
      trackRead(`node:${nodeId}`);
      return cacheNode(`node:${nodeId}`, () => scene.nodes[nodeId]);
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
      trackRead(`node:${nodeId}:children`);
      return cacheList(`children:${nodeId}`, () => {
        const node = registry.getNode(nodeId);
        if (!node?.children) return [];
        const result: SceneNode[] = [];
        for (const childId of node.children) {
          const child = registry.getNode(childId);
          if (child) result.push(child);
        }
        return result;
      });
    },

    getParent(nodeId: NodeId): SceneNode | undefined {
      checkVersion();
      trackRead(`node:${nodeId}:parentId`);
      return cacheNode(`parent:${nodeId}`, () => {
        const node = registry.getNode(nodeId);
        return node?.parentId ? registry.getNode(node.parentId) : undefined;
      });
    },

    getRoot(): SceneNode {
      checkVersion();
      trackRead("root");
      return cacheNode("root", () => {
        const root = scene.nodes[scene.rootId];
        if (!root) {
          throw new Error(`Root node "${scene.rootId}" not found`);
        }
        return root;
      });
    },

    getNodes(nodeIds: NodeId[]): SceneNode[] {
      checkVersion();
      for (const id of nodeIds) {
        trackRead(`node:${id}`);
      }
      return cacheList(`nodes:${nodeIds.join(",")}`, () => {
        const result: SceneNode[] = [];
        for (const id of nodeIds) {
          const node = registry.getNode(id);
          if (node) result.push(node);
        }
        return result;
      });
    },

    getAllNodes(): SceneNode[] {
      checkVersion();
      return cacheList("allNodes", () => Object.values(scene.nodes));
    },

    getAncestors(nodeId: NodeId): SceneNode[] {
      checkVersion();
      return cacheList(`ancestors:${nodeId}`, () => {
        const ancestors: SceneNode[] = [];
        let current = registry.getNode(nodeId)?.parentId;
        while (current) {
          trackRead(`node:${current}`);
          const parent = registry.getNode(current);
          if (!parent) break;
          ancestors.push(parent);
          current = parent.parentId;
        }
        return ancestors;
      });
    },

    getDescendants(nodeId: NodeId): SceneNode[] {
      checkVersion();
      return cacheList(`descendants:${nodeId}`, () => {
        const descendants: SceneNode[] = [];
        function walk(id: string): void {
          const node = registry.getNode(id);
          if (!node?.children) return;
          for (const childId of node.children) {
            trackRead(`node:${childId}`);
            const child = registry.getNode(childId);
            if (child) {
              descendants.push(child);
              walk(childId);
            }
          }
        }
        walk(nodeId);
        return descendants;
      });
    },

    getSiblings(nodeId: NodeId): SceneNode[] {
      checkVersion();
      trackRead(`node:${nodeId}:parentId`);
      return cacheList(`siblings:${nodeId}`, () => {
        const parent = registry.getParent(nodeId);
        if (!parent) return [];
        return (parent.children ?? [])
          .filter((id) => id !== nodeId)
          .map((id) => registry.getNode(id))
          .filter((n): n is SceneNode => n !== undefined);
      });
    },

    getDepth(nodeId: NodeId): number {
      checkVersion();
      trackRead(`node:${nodeId}:parentId`);
      return cacheNode(`depth:${nodeId}`, () => {
        let depth = 0;
        let current = registry.getNode(nodeId)?.parentId;
        while (current) {
          depth++;
          trackRead(`node:${current}`);
          const parent = registry.getNode(current);
          current = parent?.parentId;
        }
        return depth;
      });
    },

    isDescendantOf(nodeId: NodeId, ancestorId: NodeId): boolean {
      checkVersion();
      const ancestors = registry.getAncestors(nodeId);
      return ancestors.some((a) => a.id === ancestorId);
    },

    getVisibleNodes(): SceneNode[] {
      checkVersion();
      return cacheList("visibleNodes", () => {
        return Object.values(scene.nodes).filter(
          (node) => node.visible !== false,
        );
      });
    },

    invalidate(nodeId: NodeId): void {
      nodeCache.delete(`node:${nodeId}`);
      nodeCache.delete(`parent:${nodeId}`);
      nodeCache.delete(`depth:${nodeId}`);
      listCache.delete(`children:${nodeId}`);
      listCache.delete(`ancestors:${nodeId}`);
      listCache.delete(`descendants:${nodeId}`);
      listCache.delete(`siblings:${nodeId}`);
      listCache.forEach((key) => {
        if (key.startsWith(`nodes:`)) {
          const ids = key.slice(6).split(",");
          if (ids.includes(nodeId)) {
            listCache.delete(key);
          }
        }
      });

      const sourceKeys = [`node:${nodeId}`];
      const affected = graph.getTransitiveAffected(sourceKeys);
      for (const key of affected) {
        clearCacheKey(key);
      }
    },

    invalidateAll(): void {
      nodeCache.clear();
      listCache.clear();
      graph.clear();
    },

    sync(newScene: SceneGraph): void {
      scene = newScene;
      nodeCache.clear();
      listCache.clear();
      graph.clear();
      syncedVersion = newScene.version;
    },

    getVersion(): number {
      return scene.version;
    },
  };

  return registry;
}
