# Selector System

## 1. Scope

Defines the unified, memoized access layer for reading `SceneGraph`. Every read path from the scene must go through a selector.

**禁止**: `scene.nodes[id]` in business logic.

**必须**: `selector.getNode(id)`.

## 2. Principles

1. Selectors are pure functions of `SceneGraph`. Calling `getNode('a')` twice on the same scene returns the same result.
2. Selectors are memoized by `scene.version`. When the scene version changes, the cache is invalidated.
3. Selectors compose. `getChildren(id)` calls `getNode(id)` internally.
4. Selectors never mutate state. They return read-only data.

## 3. Interface

```ts
export interface SelectorRegistry {
  // — Node accessors —
  getNode(nodeId: NodeId): SceneNode | undefined
  getNodeUnsafe(nodeId: NodeId): SceneNode  // throws if missing
  getChildren(nodeId: NodeId): SceneNode[]
  getParent(nodeId: NodeId): SceneNode | undefined
  getRoot(): SceneNode

  // — Batch accessors —
  getNodes(nodeIds: NodeId[]): SceneNode[]
  getAllNodes(): SceneNode[]

  // — Hierarchy —
  getAncestors(nodeId: NodeId): SceneNode[]
  getDescendants(nodeId: NodeId): SceneNode[]
  getSiblings(nodeId: NodeId): SceneNode[]
  getDepth(nodeId: NodeId): number
  isDescendantOf(nodeId: NodeId, ancestorId: NodeId): boolean

  // — Visibility —
  getVisibleNodes(): SceneNode[]

  // — Cache management —
  invalidate(nodeId: NodeId): void
  invalidateAll(): void
  getVersion(): number
}
```

## 4. Memoization Strategy

```
scene.version=5 ──→ getNode('a') ──→ cache[5]['a']
                    getNode('a') ──→ cache[HIT]  (no recompute)
scene.version=6 ──→ getNode('a') ──→ cache[6]['a']  (miss, recompute)
```

The memo key is `scene.version`. Every mutation through the command bus increments `scene.version`. When `scene.version` differs from the cached version, all selectors recompute on next access.

For `getChildren` / `getDescendants`, the result array is also memoized. Invalidation of one node cascades to all selectors that depend on it.

## 5. Factory

```ts
export function createSelectorRegistry(scene: SceneGraph): SelectorRegistry
```

The factory captures the scene reference. When the scene is replaced (post-mutation), call `registry.sync(newScene)` or create a new registry.

## 6. Dependency Tracking (Future)

Extended selectors may track fine-grained dependencies:

```ts
selector.getNode('a')  // internally records: depends on nodes.a
// If only nodes.b changes, nodes.a selectors remain cached
```

This enables per-node invalidation without clearing the entire cache. Implemented as Phase 2 once the basic selector system is stable.

## 7. Usage Rules

1. Renderers must use selectors, not `scene.nodes`.
2. Editors must use selectors, not `scene.nodes`.
3. Tests may construct scenes and selectors independently.
4. Selectors are stateless with respect to the caller — the same registry can be used from React, Canvas, or testing.
