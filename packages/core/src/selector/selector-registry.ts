import { createScope, type Signal } from "../deps/reactive-scope.js";
import type { NodeId, SceneGraph, SceneNode } from "../types.js";

type NodeField = "structural" | "visible" | "layout" | "props";

interface SelectorNode<T = unknown> {
  readonly type: string;
  readonly key: string;
  get(): T;
  dispose(): void;
}

export interface SelectorRegistry {
  getNode(nodeId: NodeId): Readonly<SceneNode> | undefined;
  getNodeUnsafe(nodeId: NodeId): Readonly<SceneNode>;
  getChildren(nodeId: NodeId): Readonly<SceneNode>[];
  getParent(nodeId: NodeId): Readonly<SceneNode> | undefined;
  getRoot(): Readonly<SceneNode>;
  getNodes(nodeIds: NodeId[]): Readonly<SceneNode>[];
  getAllNodes(): Readonly<SceneNode>[];
  getAncestors(nodeId: NodeId): Readonly<SceneNode>[];
  getDescendants(nodeId: NodeId): Readonly<SceneNode>[];
  getSiblings(nodeId: NodeId): Readonly<SceneNode>[];
  getDepth(nodeId: NodeId): number;
  isDescendantOf(nodeId: NodeId, ancestorId: NodeId): boolean;
  getVisibleNodes(): Readonly<SceneNode>[];
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
  const structuralSignals = new Map<NodeId, Signal<number>>();
  const visibleSignals = new Map<NodeId, Signal<number>>();
  const layoutSignals = new Map<NodeId, Signal<number>>();
  const propsSignals = new Map<NodeId, Signal<number>>();
  const nodeExistenceSignal = signal(0);
  const globalEpoch = signal(0);
  const computedCache = new Map<SelectorType, Map<string, SelectorNode>>();
  let currentScene = scene;

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

    const fn = computed(() => {
      globalEpoch();
      return compute();
    });

    const node: SelectorNode<T> = {
      type,
      key,
      get(): T {
        if (disposed) {
          throw new Error(`SelectorNode(${type},${key}) has been disposed`);
        }
        return fn();
      },
      dispose(): void {
        if (disposed) return;
        disposed = true;
        fn.dispose();
        const innerMap = computedCache.get(type);
        if (innerMap && innerMap.get(key) === node) {
          innerMap.delete(key);
        }
      },
    };

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

  function readLayout(nodeId: string): void {
    getSignal(layoutSignals, nodeId)();
  }

  function readProps(nodeId: string): void {
    getSignal(propsSignals, nodeId)();
  }

  const registry: SelectorRegistry = {
    getNode(nodeId: NodeId): SceneNode | undefined {
      readStructural(nodeId);
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
        readStructural(nodeId);
        const node = currentScene.nodes[nodeId];
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
        readStructural(nodeId);
        const node = currentScene.nodes[nodeId];
        return node?.parentId ? registry.getNode(node.parentId) : undefined;
      }).get();
    },

    getRoot(): SceneNode {
      return getCached("root", "root", () => {
        readStructural(currentScene.rootId);
        const root = currentScene.nodes[currentScene.rootId];
        if (!root) {
          throw new Error(`Root node "${currentScene.rootId}" not found`);
        }
        return root;
      }).get();
    },

    getNodes(nodeIds: NodeId[]): SceneNode[] {
      for (const id of nodeIds) {
        readStructural(id);
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
        readStructural(nodeId);
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
        readStructural(nodeId);
        const descendants: SceneNode[] = [];
        function walk(id: string, visited: Set<string>): void {
          if (visited.has(id)) return;
          visited.add(id);
          const node = currentScene.nodes[id];
          if (!node?.children) return;
          for (const childId of node.children) {
            const child = registry.getNode(childId);
            if (child) {
              descendants.push(child);
              walk(childId, visited);
            }
          }
        }
        walk(nodeId, new Set());
        return descendants;
      }).get();
    },

    getSiblings(nodeId: NodeId): SceneNode[] {
      return getCached("siblings", nodeId, () => {
        readStructural(nodeId);
        const node = currentScene.nodes[nodeId];
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
      return getCached("depth", nodeId, () => {
        readStructural(nodeId);
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
        for (const id of Object.keys(currentScene.nodes)) {
          readVisible(id);
        }
        return Object.values(currentScene.nodes).filter(
          (node) => node.visible !== false,
        );
      }).get();
    },

    getNodeLayout(nodeId: NodeId): Record<string, unknown> | undefined {
      return getCached("nodeLayout", nodeId, () => {
        readLayout(nodeId);
        return currentScene.nodes[nodeId]?.layout;
      }).get();
    },

    getNodeProps(nodeId: NodeId): Record<string, unknown> | undefined {
      return getCached("nodeProps", nodeId, () => {
        readProps(nodeId);
        return currentScene.nodes[nodeId]?.props;
      }).get();
    },

    getNodeVisibility(nodeId: NodeId): boolean | undefined {
      return getCached("nodeVisibility", nodeId, () => {
        readVisible(nodeId);
        return currentScene.nodes[nodeId]?.visible;
      }).get();
    },

    invalidate(nodeId: NodeId, field?: NodeField): void {
      if (!field) {
        bumpSignal(structuralSignals, nodeId);
        bumpSignal(visibleSignals, nodeId);
        bumpSignal(layoutSignals, nodeId);
        bumpSignal(propsSignals, nodeId);
        bumpExistence();
        return;
      }
      if (field === "structural") {
        bumpSignal(structuralSignals, nodeId);
      } else if (field === "visible") {
        bumpSignal(visibleSignals, nodeId);
      } else if (field === "layout") {
        bumpSignal(layoutSignals, nodeId);
      } else if (field === "props") {
        bumpSignal(propsSignals, nodeId);
      }
    },

    notifyNodeAdded(nodeId: NodeId): void {
      bumpSignal(structuralSignals, nodeId);
      bumpExistence();
    },

    notifyNodeRemoved(nodeId: NodeId): void {
      bumpSignal(structuralSignals, nodeId);
      bumpExistence();
    },

    invalidateAll(): void {
      globalEpoch(globalEpoch() + 1);
      bumpExistence();
    },

    sync(newScene: SceneGraph): void {
      currentScene = newScene;
      structuralSignals.clear();
      visibleSignals.clear();
      layoutSignals.clear();
      propsSignals.clear();
      disposeAll();
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
