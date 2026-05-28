# Computed State Engine

## 1. Scope

Defines derived state computation that never writes back to `SceneGraph`. Handles world transforms, absolute bounding boxes, and visibility calculations that depend on the scene tree but should not be stored as primary data.

## 2. Principles

1. Computed state is **derived** from primary `SceneGraph` data. Changes to the scene invalidate computed state; computed state never modifies the scene.
2. Computed state is **memoized**. Repeated reads of the same value with no intermediate scene change return the cached result.
3. Computed state is **invalidated by dependency**. Changing a node's layout invalidates its own computed bounds AND all descendants' world transforms.
4. The computed state engine is **synchronized with the scheduler**. After a batch of mutations, the scheduler triggers the compute phase, which recalculates only the dirty nodes.

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
  getLocalTransform(nodeId: NodeId): { x: number; y: number; rotation: number }

  // — Bounds —
  getComputedBounds(nodeId: NodeId): ComputedBounds
  getVisibleBounds(nodeId: NodeId): ComputedBounds | null

  // — Layout helpers —
  getCenter(nodeId: NodeId): { x: number; y: number }
  getEdge(nodeId: NodeId, edge: 'top' | 'bottom' | 'left' | 'right'): number

  // — Cache management —
  invalidate(nodeId: NodeId): void
  invalidateAll(): void
}
```

## 4. Transform Computation

### World Transform

```
worldTransform(node) =
  localTransform(node) * parent.worldTransform(node.parentId)

localTransform(node) =
  { x: node.layout.x || 0,
    y: node.layout.y || 0,
    rotation: node.layout.rotation || 0 }
```

The world transform is the **accumulated** transform from the root to the node. For absolute-positioned nodes, the local transform IS the world position (assuming root at 0,0).

### Invalidaton Rules

| Mutation | Invalidated |
|----------|-------------|
| `update-layout` on node N | N's world transform, N's bounds, all descendants' world transforms |
| `rotate-node` on node N | N's world transform, N's bounds, all descendants' world transforms |
| `move-node` to new parent | N's world transform, old parent bounds, new parent bounds, all descendants |
| `create-node` as child of N | N's bounds (may expand), new node computed |
| `remove-node` on node N | parent bounds, all removed descendants' computed state (discarded) |

## 5. Bounds Computation

### Absolute Bounds

```
computedBounds(node) =
  world space bounding box of node layout

For absolute layout:
  width = node.layout.width || defaultWidth(node.type)
  height = node.layout.height || defaultHeight(node.type)
```

### Visible Bounds

Returns `null` if `node.visible === false`. Otherwise the visible bounding box is the intersection of the computed bounds with the viewport.

## 6. Factory

```ts
export function createComputedStateEngine(
  selectors: SelectorRegistry,
): ComputedStateEngine
```

The engine reads scene data exclusively through the `SelectorRegistry`. It never accesses `scene.nodes` directly.

## 7. Integration With Scheduler

```
Transaction commit
  → scheduler.markDirty(affectedNodes)
  → scheduler.flush()
    → compute phase:
      computedStateEngine.invalidate(dirtyNodes)
      → lazy recomputation on next read
    → render phase:
      subscribers notified
      renderer reads latest computed state via selectors + computed engine
```
