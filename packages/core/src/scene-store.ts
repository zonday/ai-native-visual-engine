import { type Patch, produceWithPatches } from "immer";
import {
  initImmerPatches,
  routeImmerPatches,
} from "./engine/immer-patch-router.js";
import type { NodeField, ScenePatch } from "./engine/patch-types.js";
import { createScope, type Signal } from "./reactive-scope.js";
import type {
  Binding,
  DeepMutable,
  NodeId,
  SceneGraph,
  SceneNode,
} from "./types.js";

// ── SceneStore ──
// Query layer only. Owns:
//   • Signal maps for fine-grained field dependency tracking
//   • SelectorNode cache (memoized computed wrappers)
//   • Lazy-rebuilt secondary indexes (tree, visibility)
//
// Does NOT own:
//   • Scene data (external SceneGraph, mutated by action handlers)
//   • Mutation timing or batching (handled by caller)
//
// Contract: callers mutate scene data directly, then call
// invalidate() to notify the registry.
//
// Public API note:
//   • SceneQueries are safe read APIs for consumers.
//   • SceneSyncControls are coordination APIs intended for engine/editor glue.
//   • SceneReactiveControls are low-level reactive/runtime helpers and should
//     generally stay inside infrastructure code.

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

interface SceneQueries {
  getScene(): SceneGraph;
  hasNode(nodeId: NodeId): boolean;
  getNode(nodeId: NodeId): SceneNode | undefined;
  getChildren(nodeId: NodeId): SceneNode[];
  getParent(nodeId: NodeId): SceneNode | undefined;
  getRoot(): SceneNode;
  getAllNodes(): SceneNode[];
  getAncestors(nodeId: NodeId): SceneNode[];
  getDescendants(nodeId: NodeId): NodeId[];
  getSiblings(nodeId: NodeId): SceneNode[];
  getDepth(nodeId: NodeId): number;
  isDescendantOf(nodeId: NodeId, ancestorId: NodeId): boolean;
  getVisibleNodes(): SceneNode[];
  getNodeLayout(nodeId: NodeId): Readonly<Record<string, unknown>> | undefined;
  getNodeLayoutKey(nodeId: NodeId, key: string): unknown;
  getNodeProps(nodeId: NodeId): Readonly<Record<string, unknown>> | undefined;
  getNodePropsKey(nodeId: NodeId, key: string): unknown;
  getNodeVisibility(nodeId: NodeId): boolean | undefined;
  isLocked(nodeId: NodeId): boolean;
  getBindings(nodeId: NodeId): readonly Binding[];
  getStyle(nodeId: NodeId): Readonly<Record<string, unknown>>;
  findNodes(predicate: (node: SceneNode) => boolean): SceneNode[];
  getVersion(): number;
}

interface SceneSyncControls {
  invalidate(nodeId: NodeId, field?: NodeField): void;
  invalidateAll(): void;

  // Apply a precomputed patch when the caller already knows the exact field
  // or structural change that occurred.
  applyPatch(patch: ScenePatch): void;

  // Replace the scene wholesale, disposing selector caches that belong to the
  // previous scene graph. Use this for destructive scene swaps like page
  // changes or full resynchronization.
  sync(newScene: SceneGraph): void;

  // Update the current scene in place. When patches are provided, this uses
  // incremental invalidation; otherwise it falls back to diffing old/new scene
  // nodes conservatively.
  setScene(newScene: SceneGraph, patches?: readonly ScenePatch[]): void;

  // Convenience helper for local transactional edits that need Immer patches
  // routed back into the store's invalidation system.
  commitScene(recipe: (draft: DeepMutable<SceneGraph>) => void): void;
}

interface SceneReactiveControls {
  batch<T>(fn: () => T): T;

  // Flushes pending reactive effects in the underlying scope. Most app-level
  // callers should not need this directly.
  flush(): void;

  // Internal cache management hook used by tests and low-level engine code.
  removeSelector(type: string, key: string): boolean;

  // Low-level reactive autorun helper. Prefer higher-level engine/editor state
  // subscriptions unless you specifically need selector dependency tracking.
  autorun(fn: () => void): () => void;

  // Lifecycle hook for infrastructure that needs to dispose dependent caches
  // before a scene swap clears selector internals.
  onBeforeDispose(cb: () => void): () => void;
}

export interface SceneStore
  extends SceneQueries,
    SceneSyncControls,
    SceneReactiveControls {}

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
  | "nodeLayoutKey"
  | "nodeProps"
  | "nodePropsKey"
  | "nodeVisibility";

export function createSceneStore(scene: Readonly<SceneGraph>): SceneStore {
  const {
    signal,
    computed,
    effect,
    startBatch,
    endBatch,
    flush: flushScope,
  } = createScope();
  const childrenSignals = new Map<NodeId, Signal<number>>();
  const parentSignals = new Map<NodeId, Signal<number>>();
  const visibleSignals = new Map<NodeId, Signal<number>>();
  const layoutSignals = new Map<NodeId, Signal<number>>();
  const propsSignals = new Map<NodeId, Signal<number>>();
  const styleSignals = new Map<NodeId, Signal<number>>();
  const bindingsSignals = new Map<NodeId, Signal<number>>();
  const layoutKeySignals = new Map<string, Signal<number>>();
  const propsKeySignals = new Map<string, Signal<number>>();
  const nodeExistenceSignal = signal(0);
  const computedCache = new Map<SelectorType, Map<string, SelectorNode>>();
  const accessCounts = new WeakMap<SelectorNode, number>();
  let currentScene = scene;
  let batchDepth = 0;
  const pendingBatchSignals = new Set<string>();
  const disposeCallbacks = new Set<() => void>();
  let activeReaction: Set<SelectorNode> | null = null;

  // ── Indexes ──
  const subtreeSignals = new Map<NodeId, Signal<number>>();
  const treeIndexSignal = signal(0);
  let flattenedNodes: NodeId[] = [];
  const treeIndex = new Map<NodeId, TreeIndexEntry>();
  let treeIndexDirty = false;
  const descResultCache = new Map<NodeId, { version: number; ids: NodeId[] }>();

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
  }

  function ensureTreeIndex(): void {
    if (!treeIndexDirty) return;
    treeIndexDirty = false;
    rebuildTreeIndex();
  }

  function markTreeIndexDirty(): void {
    if (treeIndexDirty) return;
    treeIndexDirty = true;
    if (batchDepth > 0) {
      pendingBatchSignals.add("treeIndex");
    }
  }

  function trackSubtree(nodeId: NodeId): number {
    return getSignal(subtreeSignals, nodeId)();
  }

  function markSubtreeDirty(nodeId: NodeId): void {
    // Walk up ancestor chain, bumping each node's subtree signal.
    // treeIndexSignal is bumped as global fallback for batch/emergency.
    let current: NodeId | undefined = nodeId;

    if (batchDepth > 0) {
      pendingBatchSignals.add("treeIndex");
      return;
    }
    treeIndexSignal(treeIndexSignal() + 1);
    while (current) {
      const s = subtreeSignals.get(current);
      if (s) s(s() + 1);
      current = currentScene.nodes[current]?.parentId;
    }
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
    if (batchDepth > 0) {
      pendingBatchSignals.add("visibilityIndex");
      return;
    }
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

  function trackStyle(nodeId: NodeId): void {
    getSignal(styleSignals, nodeId)();
  }

  function trackBindings(nodeId: NodeId): void {
    getSignal(bindingsSignals, nodeId)();
  }

  function trackVisibility(nodeId: NodeId): void {
    getSignal(visibleSignals, nodeId)();
  }

  function trackLayoutKey(nodeId: NodeId, key: string): void {
    const k = `${nodeId}:${key}`;
    let s = layoutKeySignals.get(k);
    if (!s) {
      s = signal(0);
      layoutKeySignals.set(k, s);
    }
    s();
  }

  function bumpLayoutKey(nodeId: NodeId, key: string): void {
    const k = `${nodeId}:${key}`;
    const s = layoutKeySignals.get(k);
    if (s) s(s() + 1);
  }

  function trackPropsKey(nodeId: NodeId, key: string): void {
    const k = `${nodeId}:${key}`;
    let s = propsKeySignals.get(k);
    if (!s) {
      s = signal(0);
      propsKeySignals.set(k, s);
    }
    s();
  }

  function bumpPropsKey(nodeId: NodeId, key: string): void {
    const k = `${nodeId}:${key}`;
    const s = propsKeySignals.get(k);
    if (s) s(s() + 1);
  }

  // ── Patch routing ──
  function handlePatch(patch: ScenePatch): void {
    if (patch.type === "set-prop") {
      const { nodeId, field, key } = patch;
      if (key) {
        if (field === "layout") bumpLayoutKey(nodeId, key);
        else if (field === "props") bumpPropsKey(nodeId, key);
      }
      if (field === "visible") markVisibilityIndexDirty();
      if (field === "children" || field === "parent") {
        markSubtreeDirty(nodeId);
        markTreeIndexDirty();
      }
      bumpSignal(
        field === "children"
          ? childrenSignals
          : field === "parent"
            ? parentSignals
            : field === "visible"
              ? visibleSignals
              : field === "layout"
                ? layoutSignals
                : field === "style"
                  ? styleSignals
                  : field === "bindings"
                    ? bindingsSignals
                    : propsSignals,
        nodeId,
      );
    } else if (patch.type === "reparent") {
      markSubtreeDirty(patch.nodeId);
      if (patch.oldParent) markSubtreeDirty(patch.oldParent);
      markSubtreeDirty(patch.newParent);
      markTreeIndexDirty();
      bumpSignal(parentSignals, patch.nodeId);
      if (patch.oldParent) bumpSignal(childrenSignals, patch.oldParent);
      bumpSignal(childrenSignals, patch.newParent);
    } else if (patch.type === "remove-node") {
      markSubtreeDirty(patch.nodeId);
      markTreeIndexDirty();
      markVisibilityIndexDirty();
      bumpSignal(childrenSignals, patch.nodeId);
      bumpSignal(parentSignals, patch.nodeId);
      bumpExistence();
      descResultCache.delete(patch.nodeId);
    } else if (patch.type === "add-node") {
      markSubtreeDirty(patch.nodeId);
      markTreeIndexDirty();
      markVisibilityIndexDirty();
      bumpSignal(childrenSignals, patch.nodeId);
      bumpSignal(parentSignals, patch.nodeId);
      bumpExistence();
    }
  }

  function syncExistingNode(
    nodeId: NodeId,
    oldNode: SceneNode,
    newNode: SceneNode,
  ): void {
    if (oldNode.parentId !== newNode.parentId && newNode.parentId) {
      handlePatch({
        type: "reparent",
        nodeId,
        oldParent: oldNode.parentId,
        newParent: newNode.parentId,
      });
    }

    if (oldNode.children !== newNode.children) {
      handlePatch({ type: "set-prop", nodeId, field: "children" });
    }

    if (oldNode.visible !== newNode.visible) {
      handlePatch({ type: "set-prop", nodeId, field: "visible" });
    }

    if (oldNode.layout !== newNode.layout) {
      handlePatch({ type: "set-prop", nodeId, field: "layout" });
    }

    if (oldNode.props !== newNode.props) {
      handlePatch({ type: "set-prop", nodeId, field: "props" });
    }

    if (oldNode.style !== newNode.style) {
      handlePatch({ type: "set-prop", nodeId, field: "style" });
    }

    if (oldNode.bindings !== newNode.bindings) {
      handlePatch({ type: "set-prop", nodeId, field: "bindings" });
    }
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
      const innerMap = computedCache.get(type as SelectorType);
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
        if (activeReaction && !activeReaction.has(node)) {
          activeReaction.add(node);
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

  function flushPendingSignals(): void {
    if (pendingBatchSignals.has("treeIndex") && treeIndexDirty) {
      treeIndexSignal(treeIndexSignal() + 1);
    }
    if (pendingBatchSignals.has("visibilityIndex") && visibilityIndexDirty) {
      visibilityIndexSignal(visibilityIndexSignal() + 1);
    }
    pendingBatchSignals.clear();
  }

  function disposeAll(): void {
    for (const innerMap of computedCache.values()) {
      const nodes = [...innerMap.values()];
      for (const node of nodes) {
        node.dispose();
      }
    }
    computedCache.clear();
    descResultCache.clear();
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
      n.ref();
      innerMap.set(key, n);
      enforceCacheLimit();
    }
    return n;
  }

  const registry: SceneStore = {
    getScene(): SceneGraph {
      return currentScene;
    },
    hasNode(nodeId: NodeId): boolean {
      nodeExistenceSignal();
      return currentScene.nodes[nodeId] !== undefined;
    },
    // getNode returns the raw node — no proxy. Callers must explicitly
    // declare field dependencies via trackChildren / trackParent / etc.
    getNode(nodeId: NodeId): SceneNode | undefined {
      return currentScene.nodes[nodeId];
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
          trackParent(currentId);
          const parent = currentScene.nodes[currentId];
          if (!parent) break;
          ancestors.push(parent);
          currentId = parent.parentId;
        }
        return ancestors;
      }).get();
    },

    getDescendants(nodeId: NodeId): NodeId[] {
      return getCached("descendants", nodeId, () => {
        trackChildren(nodeId);
        ensureTreeIndex();
        treeIndexSignal();
        const version = trackSubtree(nodeId);
        const entry = treeIndex.get(nodeId);
        if (!entry) {
          descResultCache.delete(nodeId);
          return [];
        }
        const cached = descResultCache.get(nodeId);
        if (cached && cached.version === version) return cached.ids;
        const ids = flattenedNodes.slice(
          entry.preorder + 1,
          entry.preorder + entry.subtreeSize,
        );
        // Structural sharing: same ID slice → same array reference.
        // Descendants is a structural-only selector — returns NodeId[],
        // not SceneNode[]. Consumers requiring full node data compose
        // with getNode() or field selectors.
        const prev = descResultCache.get(nodeId);
        if (
          prev &&
          prev.ids.length === ids.length &&
          prev.ids.every((id, i) => id === ids[i])
        ) {
          return prev.ids;
        }
        descResultCache.set(nodeId, { version, ids });
        return ids;
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
          trackParent(currentId);
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
        trackSubtree(ancestorId);
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

    getNodeLayout(
      nodeId: NodeId,
    ): Readonly<Record<string, unknown>> | undefined {
      return getCached("nodeLayout", nodeId, () => {
        trackLayout(nodeId);
        const layout = currentScene.nodes[nodeId]?.layout;
        return layout ? { ...layout } : undefined;
      }).get();
    },

    getNodeLayoutKey(nodeId: NodeId, key: string): unknown {
      return getCached("nodeLayoutKey", `${nodeId}:${key}`, () => {
        trackLayout(nodeId);
        trackLayoutKey(nodeId, key);
        const layout = currentScene.nodes[nodeId]?.layout;
        return layout && typeof layout === "object"
          ? (layout as Record<string, unknown>)[key]
          : undefined;
      }).get();
    },

    getNodeProps(
      nodeId: NodeId,
    ): Readonly<Record<string, unknown>> | undefined {
      return getCached("nodeProps", nodeId, () => {
        trackProps(nodeId);
        const props = currentScene.nodes[nodeId]?.props;
        return props ? { ...props } : undefined;
      }).get();
    },

    getNodePropsKey(nodeId: NodeId, key: string): unknown {
      return getCached("nodePropsKey", `${nodeId}:${key}`, () => {
        trackProps(nodeId);
        trackPropsKey(nodeId, key);
        const props = currentScene.nodes[nodeId]?.props;
        return props && typeof props === "object"
          ? (props as Record<string, unknown>)[key]
          : undefined;
      }).get();
    },

    getNodeVisibility(nodeId: NodeId): boolean | undefined {
      return getCached("nodeVisibility", nodeId, () => {
        trackVisibility(nodeId);
        return currentScene.nodes[nodeId]?.visible;
      }).get();
    },

    isLocked(nodeId: NodeId): boolean {
      return currentScene.nodes[nodeId]?.locked === true;
    },

    getBindings(nodeId: NodeId): readonly Binding[] {
      trackBindings(nodeId);
      const node = currentScene.nodes[nodeId];
      return node?.bindings ? [...node.bindings] : [];
    },

    getStyle(nodeId: NodeId): Readonly<Record<string, unknown>> {
      trackStyle(nodeId);
      const node = currentScene.nodes[nodeId];
      return node?.style ? { ...node.style } : {};
    },

    findNodes(predicate: (node: SceneNode) => boolean): SceneNode[] {
      const result: SceneNode[] = [];
      for (const node of Object.values(currentScene.nodes)) {
        if (predicate(node)) {
          result.push(node);
        }
      }
      return result;
    },

    invalidate(nodeId: NodeId, field?: NodeField): void {
      const isStructural = !field || field === "children" || field === "parent";
      if (isStructural) {
        markSubtreeDirty(nodeId);
        markTreeIndexDirty();
      }
      if (!field || field === "visible") markVisibilityIndexDirty();

      if (!field) {
        bumpSignal(childrenSignals, nodeId);
        bumpSignal(parentSignals, nodeId);
        bumpSignal(visibleSignals, nodeId);
        bumpSignal(layoutSignals, nodeId);
        bumpSignal(propsSignals, nodeId);
        bumpSignal(styleSignals, nodeId);
        bumpSignal(bindingsSignals, nodeId);
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
      } else if (field === "style") {
        bumpSignal(styleSignals, nodeId);
      } else if (field === "bindings") {
        bumpSignal(bindingsSignals, nodeId);
      }
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
      for (const cb of disposeCallbacks) cb();
      currentScene = newScene;
      childrenSignals.clear();
      parentSignals.clear();
      visibleSignals.clear();
      layoutSignals.clear();
      propsSignals.clear();
      styleSignals.clear();
      bindingsSignals.clear();
      disposeAll();
      rebuildTreeIndex();
      treeIndexDirty = false;
      rebuildVisibilityIndex();
      visibilityIndexDirty = false;
      bumpExistence();
    },

    setScene(newScene: SceneGraph, patches?: readonly ScenePatch[]): void {
      const oldScene = currentScene;
      currentScene = newScene;

      if (patches) {
        for (const patch of patches) {
          handlePatch(patch);
        }
      } else {
        // No info — iterate all nodes to find changes
        for (const id of Object.keys(oldScene.nodes)) {
          if (!newScene.nodes[id])
            handlePatch({ type: "remove-node", nodeId: id });
        }
        for (const id of Object.keys(newScene.nodes)) {
          const oldNode = oldScene.nodes[id];
          const newNode = newScene.nodes[id];

          if (!newNode) {
            continue;
          }
          if (!oldNode) {
            handlePatch({ type: "add-node", nodeId: id });
          } else if (oldNode !== newNode) {
            syncExistingNode(id, oldNode, newNode);
          }
        }
      }

      bumpExistence();
    },

    getVersion(): number {
      return currentScene.version;
    },

    batch<T>(fn: () => T): T {
      batchDepth++;
      if (batchDepth === 1) startBatch();
      try {
        return fn();
      } finally {
        batchDepth--;
        if (batchDepth === 0) {
          flushPendingSignals();
          endBatch();
        }
      }
    },

    flush(): void {
      flushScope();
    },

    removeSelector(type: string, key: string): boolean {
      const innerMap = computedCache.get(type as SelectorType);
      if (!innerMap) return false;
      const node = innerMap.get(key);
      if (!node) return false;
      node.dispose();
      return true;
    },

    onBeforeDispose(cb: () => void): () => void {
      disposeCallbacks.add(cb);
      return () => disposeCallbacks.delete(cb);
    },

    commitScene(recipe: (draft: DeepMutable<SceneGraph>) => void): void {
      initImmerPatches();
      const [next, patches] = produceWithPatches(
        currentScene,
        (draft: DeepMutable<SceneGraph>) => {
          recipe(draft as DeepMutable<SceneGraph>);
        },
      ) as [SceneGraph, Patch[], Patch[]];
      // eslint-disable-next-line no-restricted-imports
      currentScene = next;
      markTreeIndexDirty();
      markVisibilityIndexDirty();
      routeImmerPatches(patches, registry);
    },

    autorun(fn: () => void): () => void {
      const deps = new Set<SelectorNode>();
      let stopped = false;

      const dispose = effect(() => {
        // Unref deps from previous run
        for (const dep of deps) dep.unref();
        deps.clear();

        // Run fn with tracking, then ref new deps
        const prev = activeReaction;
        activeReaction = deps;
        try {
          fn();
        } finally {
          activeReaction = prev;
        }
        for (const dep of deps) dep.ref();
      });

      return () => {
        if (stopped) return;
        stopped = true;
        dispose();
        for (const dep of deps) dep.unref();
        deps.clear();
      };
    },
  };

  return registry;
}
