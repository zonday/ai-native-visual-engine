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
  invalidate(): void;
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

function defaultSelectorNode<T>(
  type: string,
  key: string,
  compute: () => T,
): SelectorNode<T> {
  let version = 0;
  const deps = new Set<SelectorNode>();
  const subs = new Set<SelectorNode>();

  const node: SelectorNode<T> = {
    type,
    key,
    deps,
    subs,
    get version() {
      return version;
    },
    get(): T {
      return compute();
    },
    invalidate(): void {
      version++;
      for (const sub of subs) {
        sub.invalidate();
      }
    },
  };

  return node;
}

export function createSelectorRegistry(
  scene: Readonly<SceneGraph>,
): SelectorRegistry {
  const { signal, computed } = createScope();
  const structuralSignals = new Map<NodeId, Signal<number>>();
  const visibleSignals = new Map<NodeId, Signal<number>>();
  const computedCache = new Map<SelectorType, Map<string, SelectorNode>>();
  let syncedVersion = scene.version;

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

  function bumpAll(map: Map<NodeId, Signal<number>>): void {
    for (const [, s] of map) s(s() + 1);
  }

  function checkVersion(): void {
    if (scene.version !== syncedVersion) {
      structuralSignals.clear();
      visibleSignals.clear();
      computedCache.clear();
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
      const reactiveFn = computed(compute) as () => T;
      n = defaultSelectorNode(type, key, reactiveFn);
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
      return getCached("allNodes", "all", () =>
        Object.values(scene.nodes),
      ).get();
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
      const ancestors = registry.getAncestors(nodeId);
      return ancestors.some((a) => a.id === ancestorId);
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
        return;
      }
      if (field === "structural") bumpSignal(structuralSignals, nodeId);
      else if (field === "visible") bumpSignal(visibleSignals, nodeId);
      else if (field === "layout") bumpSignal(structuralSignals, nodeId);
      else if (field === "props") bumpSignal(structuralSignals, nodeId);
    },

    invalidateAll(): void {
      bumpAll(structuralSignals);
      bumpAll(visibleSignals);
    },

    sync(newScene: SceneGraph): void {
      scene = newScene;
      structuralSignals.clear();
      visibleSignals.clear();
      computedCache.clear();
      syncedVersion = newScene.version;
    },

    getVersion(): number {
      return scene.version;
    },
  };

  return registry;
}
