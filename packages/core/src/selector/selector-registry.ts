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

export function createSelectorRegistry(scene: SceneGraph): SelectorRegistry {
  const { signal, computed } = createScope();
  const versionSignals = new Map<NodeId, Signal<number>>();
  const computedCache = new Map<string, () => unknown>();
  let syncedVersion = scene.version;

  function getVersionSignal(nodeId: string): () => number {
    let s = versionSignals.get(nodeId);
    if (!s) {
      s = signal(0);
      versionSignals.set(nodeId, s);
    }
    return s;
  }

  function checkVersion(): void {
    if (scene.version !== syncedVersion) {
      versionSignals.clear();
      computedCache.clear();
      syncedVersion = scene.version;
    }
  }

  function getCached<T>(key: string, compute: () => T): () => T {
    let c = computedCache.get(key) as (() => T) | undefined;
    if (!c) {
      c = computed(compute) as () => T;
      computedCache.set(key, c);
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
      return getCached(`children:${nodeId}`, () => {
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
      return getCached(`parent:${nodeId}`, () => {
        getVersionSignal(nodeId)();
        const node = scene.nodes[nodeId];
        return node?.parentId ? registry.getNode(node.parentId) : undefined;
      })();
    },

    getRoot(): SceneNode {
      checkVersion();
      return getCached("root", () => {
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
      const key = `nodes:${nodeIds.join(",")}`;
      return getCached(key, () => {
        const result: SceneNode[] = [];
        for (const id of nodeIds) {
          const node = registry.getNode(id);
          if (node) result.push(node);
        }
        return result;
      })();
    },

    getAllNodes(): SceneNode[] {
      checkVersion();
      return getCached("allNodes", () => Object.values(scene.nodes))();
    },

    getAncestors(nodeId: NodeId): SceneNode[] {
      checkVersion();
      return getCached(`ancestors:${nodeId}`, () => {
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
      return getCached(`descendants:${nodeId}`, () => {
        getVersionSignal(nodeId)();
        const descendants: SceneNode[] = [];
        function walk(id: string): void {
          const node = scene.nodes[id];
          if (!node?.children) return;
          for (const childId of node.children) {
            const child = registry.getNode(childId);
            if (child) {
              descendants.push(child);
              walk(childId);
            }
          }
        }
        walk(nodeId);
        return descendants;
      })();
    },

    getSiblings(nodeId: NodeId): SceneNode[] {
      checkVersion();
      return getCached(`siblings:${nodeId}`, () => {
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
      return getCached(`depth:${nodeId}`, () => {
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
      return getCached("visibleNodes", () => {
        for (const id of Object.keys(scene.nodes)) {
          getVersionSignal(id)();
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
      versionSignals.clear();
      computedCache.clear();
    },

    sync(newScene: SceneGraph): void {
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
