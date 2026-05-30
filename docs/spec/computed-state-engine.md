# Computed State Engine

## 1. Scope

Defines derived state computation that never writes back to `SceneGraph`. Handles world transforms, absolute bounding boxes, and visibility calculations that depend on the scene tree but should not be stored as primary data.

## 2. Principles

1. Computed state is **derived** from primary `SceneGraph` data. Changes to the scene invalidate computed state; computed state never modifies the scene.
2. Computed state is **memoized via reactive signal graph**. The engine wraps each derivation in a `computed()` node from the reactive scope. The signal graph handles dependency tracking, lazy re-evaluation, and automatic invalidation when a dependency signal changes.
3. There is **no secondary manual cache layer**. The outer `Map<nodeId, ComputedRef>` stores only the reactive computed function reference — it does not duplicate the memoization. The signal graph is the sole caching mechanism.
4. Computed state is **invalidated by dependency cascade**. Changing a node's layout signal invalidates its own computed AND all descendants' computed values through the reactive subscriber chain.
5. `invalidate(nodeId)` clears the cached computed reference for the target node and all its descendants, then bumps the layout signal to trigger reactive re-evaluation.
6. The engine registers an `onBeforeDispose` callback on the `SelectorRegistry`. When the registry syncs to a new `SceneGraph` (page switch, undo, etc.), all computed refs are disposed and caches cleared — preventing reads from stale SelectorNodes.

## 3. Interface

```ts
export interface WorldTransform {
  x: number
  y: number
  rotation: number
  scaleX: number
  scaleY: number
}

export interface ComputedBounds {
  x: number
  y: number
  width: number
  height: number
}

export interface ComputedStateEngine {
  // — Transforms —
  getWorldTransform(nodeId: NodeId): WorldTransform
  getLocalTransform(nodeId: NodeId): WorldTransform

  // — Bounds —
  getComputedBounds(nodeId: NodeId): ComputedBounds
  getVisibleBounds(nodeId: NodeId, viewport?: ViewportRect): ComputedBounds | null

  // — Layout helpers —
  getCenter(nodeId: NodeId): { x: number; y: number }
  getEdge(nodeId: NodeId, edge: 'top' | 'bottom' | 'left' | 'right'): number

  // — Cache management —
  invalidate(nodeId: NodeId): void
  invalidateAll(): void
}
```

## 4. Transform Computation

### Local Transform

Reads from `node.layout` for `absolute`/`free` mode nodes. Returns identity `{x:0, y:0, rotation:0, scaleX:1, scaleY:1}` for layout modes that delegate positioning to the browser (flex, grid).

### World Transform

```
worldTransform(node) =
  parentWorld ⊕ localTransform

where ⊕ is affine composition:

  parentRad = parent.rotation × π / 180
  rotatedX = local.x × parent.scaleX × cos(parentRad) - local.y × parent.scaleY × sin(parentRad)
  rotatedY = local.x × parent.scaleX × sin(parentRad) + local.y × parent.scaleY × cos(parentRad)

  result.x = parent.x + rotatedX
  result.y = parent.y + rotatedY
  result.rotation = parent.rotation + local.rotation
  result.scaleX = parent.scaleX × local.scaleX
  result.scaleY = parent.scaleY × local.scaleY
```

The world transform is the **accumulated affine transform** from the root to the node. Unlike a simple additive model, the parent's rotation and scale are applied to the child's local offset before adding to the parent's position. This ensures correct positioning under rotated or scaled parent containers.

### Invalidaton Rules

| Mutation | Engine Behavior |
|----------|----------------|
| `invalidate(nodeId)` | Clears computed ref for N and all descendants from all caches; bumps N's layout signal |
| `invalidateAll()` | Disposes all computed refs and clears all caches; calls `selectors.invalidateAll()` |
| SelectorRegistry `sync()` | `onBeforeDispose` callback fires; all computed refs disposed and caches cleared |

### Cross-Package Safety: Scene Sync

The engine no longer uses a version-based `clearIfStale()` barrier. Instead, it registers an `onBeforeDispose` callback on the `SelectorRegistry`. When `sync()` replaces the internal scene graph, all computed refs are disposed before the registry's SelectorNodes are torn down. This prevents reads from stale or disposed signal nodes.

## 5. Bounds Computation

### Absolute Bounds

```
computedBounds(node) =
  world space bounding box of node layout

For absolute layout:
  width = node.layout.width || defaultWidth(node.type)
  height = node.layout.height || defaultHeight(node.type)
```

Bounds are axis-aligned and do not account for node rotation (AABB of the translated rectangle).

### Visible Bounds

Returns `null` if `node.visible === false`. Otherwise the visible bounding box is the intersection of the computed bounds with the viewport. When no viewport is provided, returns the full computed bounds.

The viewport cache uses a two-level `Map<NodeId, Map<viewportKey, ComputedRef>>` structure instead of string concatenation, avoiding GC pressure from repeated string allocation.

## 6. Factory

```ts
export function createComputedStateEngine(
  selectors: SelectorRegistry,
): ComputedStateEngine
```

The engine reads scene data exclusively through the `SelectorRegistry`. It never accesses `scene.nodes` directly.

Internal design:
- Each derivation is backed by a `computed()` node from the reactive scope (alien-signals).
- Computed refs are stored in typed `Map<NodeId, ComputedRef<T>>` — no double caching.
- `invalidate(nodeId)` disposes the old `ComputedRef` before deleting it, preventing orphaned signal graph nodes and memory leaks.
- The visible bounds cache avoids string-concatenation keys by nesting `Map<NodeId, Map<string, ...>>`.

## 7. Integration With Scheduler

```
Transaction commit
  → scheduler.markDirty(affectedNodes)
  → scheduler.flush()
    → compute phase:
      computedStateEngine.invalidate(dirtyNodes)
      → lazy recomputation on next read (signal graph)
    → render phase:
      subscribers notified
      renderer reads latest computed state via selectors + computed engine
```
