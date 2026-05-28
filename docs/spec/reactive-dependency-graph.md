# Reactive Dependency Graph Specification

Version: Draft
Status: Proposed
Target: AI-Native Visual Runtime Engine

---

## 1. Overview

The Reactive Dependency Graph (RDG) serves as the incremental computation core of the runtime engine.

Its primary responsibilities include:

- Track dependencies
- Propagate invalidation
- Schedule recomputation
- Enable incremental rendering

The RDG transforms the runtime from a:

> Mutable JSON Tree

into an:

> Incremental Reactive Runtime

---

## 2. Goals

The RDG must support:

- Fine-grained incremental updates
- Derived and computed state
- Dirty-state propagation
- Dependency tracking
- Incremental rendering
- Scheduler integration
- Deterministic recomputation
- Renderer-independent runtime computation

---

## 3. Non-Goals

The RDG is not responsible for:

- History management
- Undo/Redo functionality
- Collaboration systems
- CRDT implementation
- Persistence
- Semantic planning
- Renderer implementation

These systems consume RDG outputs but are not considered part of the graph itself.

---

## 4. Core Concepts

### 4.1 Runtime Graph

The runtime is not solely a scene tree.

It consists of:

```
SceneGraph
  +
DependencyGraph
```

---

### 4.2 Dependency Edge

A dependency edge indicates that:

> A depends on B

If B changes:

> A becomes dirty

---

### 4.3 Dirty State

A dirty node indicates that:

> Computed value is invalid

Dirty nodes must be recomputed prior to consumption.

---

### 4.4 Computed State

Computed state represents derived runtime state.

Examples include:

- World transform
- Layout bounds
- Visibility
- Computed style
- Selection bounds
- Snap guides

Computed state must not be stored directly within the SceneGraph.

---

## 5. Graph Architecture

### 5.1 Graph Layers

```
SceneGraph
  ->
Reactive Dependency Graph
  ->
Scheduler
  ->
Renderer
```

---

### 5.2 Reactive Node Types

The RDG contains multiple categories of nodes.

#### Source Nodes

Source nodes represent mutable runtime state.

Examples:

- node.props
- node.transform
- node.layout

Source nodes originate from transactions.

#### Computed Nodes

Computed nodes represent derived values.

Examples:

- worldTransform
- computedLayout
- selectionBounds
- visibleBounds

Computed nodes are recomputed lazily.

#### Effect Nodes

Effect nodes trigger runtime side effects.

Examples:

- render invalidation
- overlay updates
- hit testing refresh

---

## 6. Dependency Model

### 6.1 Dependency Registration

Dependencies must be tracked automatically.

Example:

```ts
const worldTransform = computed(() => {
  return multiply(
    parent.worldTransform(),
    localTransform(),
  )
})
```

This automatically registers:

```
worldTransform
  depends on:
    parent.worldTransform
    localTransform
```

---

### 6.2 Dependency Graph

Dependencies form a directed graph.

```
localTransform
    ↓
worldTransform
    ↓
layoutBounds
    ↓
selectionBounds
    ↓
overlayRender
```

---

### 6.3 Cycles

Dependency cycles are prohibited.

The runtime must detect cycles during dependency registration.

Invalid:

```
A -> B -> C -> A
```

---

## 7. Dirty Propagation

### 7.1 Mutation

A transaction mutates source state.

Example:

```
set-node-width
```

---

### 7.2 Dirty Marking

The mutation marks dependent nodes as dirty.

Example:

```
node width changed
  ->
layout dirty
  ->
selection dirty
  ->
render dirty
```

---

### 7.3 Lazy Recompute

Dirty nodes must not be recomputed immediately.

Recomputation occurs:

- on demand
- or during scheduled flush

---

## 8. Scheduler Integration

### 8.1 Scheduler Role

The scheduler coordinates recomputation phases.

### 8.2 Runtime Phases

Recommended phases:

1. transaction phase
2. dirty propagation phase
3. computed phase
4. layout phase
5. render phase
6. overlay phase

### 8.3 Batched Updates

Multiple mutations must be batched.

Forbidden:

```
mutation -> immediate recompute
```

Required:

```
multiple mutations -> single recompute pass
```

---

## 9. Selector System

Selectors serve as graph entry points.

Selectors must consume computed nodes.

### 9.1 Selector Examples

- selectNode(id)
- selectWorldTransform(id)
- selectComputedLayout(id)
- selectVisibleNodes()

### 9.2 Selector Requirements

Selectors must support:

- Memoization
- Dependency tracking
- Lazy evaluation
- Incremental recomputation

---

## 10. Computed System

### 10.1 Computed Requirements

Computed nodes must:

- Cache values
- Track dependencies
- Invalidate correctly
- Recompute deterministically

### 10.2 Forbidden Patterns

Forbidden: write computed values back into scene

Invalid:

```
node.worldTransform = ...
```

---

## 11. Renderer Integration

The renderer must not directly traverse mutable scene state.

The renderer consumes:

> computed runtime outputs

### 11.1 Render Dependency

Render invalidation must be incremental.

Invalid:

```
whole scene rerender
```

Required:

```
dirty subtree rerender
```

---

## 12. Interaction Integration

Interaction systems depend on computed runtime state.

Examples include:

- Hit testing
- Selection
- Snap lines
- Hover overlays

These systems must consume selectors and computed nodes.

---

## 13. Transaction Integration

Transactions mutate source state.

The RDG reacts to mutations.

Flow:

```
transaction
  ->
source mutation
  ->
dirty propagation
  ->
scheduler
  ->
recompute
```

---

## 14. Runtime Invariants

The RDG must guarantee:

- Deterministic recomputation
- Acyclic dependencies
- Stable dependency registration
- No stale computed cache
- No hidden mutable derived state

---

## 15. Memory Model

### 15.1 Cached Computed Values

Computed values may be cached.

Unused computed nodes may be garbage-collected.

### 15.2 Weak References

Dependency edges should support weak references where possible.

---

## 16. Incremental Rendering

The RDG enables:

> partial recomputation + partial rendering

instead of:

> full runtime recomputation

---

## 17. Debugging Requirements

The RDG should expose debugging tools.

Recommended:

- dependency graph visualization
- dirty graph visualization
- recompute tracing
- scheduler timeline
- selector tracing

---

## 18. Performance Goals

The RDG should optimize for:

- Minimal recomputation
- Minimal rerendering
- Stable cache locality
- Predictable invalidation cost

---

## 19. Recommended Package Structure

```
packages/
  runtime/
    dependency/
      graph/
      node/
      edge/
      invalidate/
      scheduler/
    computed/
      computed-node/
      cache/
      selector/
    interaction/
    layout/
```

---

## 20. Suggested Internal Interfaces

### Dependency Node

```ts
interface DependencyNode<T> {
  id: string
  version: number
  dirty: boolean
  dependencies: Set<DependencyNode>
  subscribers: Set<DependencyNode>
  compute?: () => T
  cachedValue?: T
}
```

### Computed Node

```ts
interface ComputedNode<T>
  extends DependencyNode<T> {
  evaluate(): T
  invalidate(): void
}
```

---

## 21. Recommended Runtime Flow

```
transaction
  ->
source mutation
  ->
mark dirty
  ->
scheduler flush
  ->
recompute computed nodes
  ->
emit render invalidation
  ->
renderer update
```

---

## 22. Recommended Initial Scope

Phase 1 implementation should support only:

- Source nodes
- Computed nodes
- Dirty propagation
- Scheduler batching
- Selectors

The following should not be implemented initially:

- Distributed graph
- CRDT graph synchronization
- Cross-runtime graph synchronization
- Asynchronous dependency resolution

---

## 23. Implementation — alien-signals Integration

We use the `alien-signals` library (^3.2.1) as the dependency-tracking primitive.

### 23.1 Mapping

| Spec Concept | alien-signals Primitive |
|---|---|
| Source node | `signal<T>(initialValue)` wrapping a version counter |
| Computed node | `computed<T>(getter)` — tracks reads, caches result |
| Dependency edge | Implicit — tracked during `computed()` getter execution |
| Dirty propagation | Subscriber notification on source `signal` write |
| Lazy recompute | `computed()` re-evaluates on next `.get()` when dirty |

### 23.2 Version-Signal Pattern

Rather than wrapping scene data directly in signals (which would require deep cloning on mutation), we use a lightweight version-signal pattern:

```ts
// Each node gets a version counter signal
const versionSignals = new Map<NodeId, Signal<number>>()

// Computed reads the version signal AND reads scene data directly
const children = computed(() => {
  // Track dependency on this node's version
  getVersionSignal(nodeId)()
  // Read scene data directly
  const node = scene.nodes[nodeId]
  // ... derive result
  return result
})

// On mutation, increment the version signal
function invalidate(nodeId: NodeId): void {
  const s = versionSignals.get(nodeId)
  if (s) s(s() + 1)
}
```

This avoids cloning scene data into signals while still providing fine-grained invalidation.

### 23.3 Computed Cascade

Computed nodes that depend on other computeds create a cascade chain:

```ts
const worldTransform = computed(() => {
  getVersionSignal(nodeId)()
  const parent = selectors.getParent(nodeId)
  if (parent) {
    const parentTx = engine.getWorldTransform(parent.id)
    // alien-signals tracks: this computed depends on parent's worldTransform computed
  }
  // ...
})
```

When a source is invalidated, alien-signals lazily dirties all transitively dependent computeds.

### 23.4 Scheduler Integration

The scheduler's compute phase triggers flushing of dirty computeds. alien-signals handles batching internally — multiple source mutations within the same microtask only trigger one recompute pass.

---

## 24. Long-Term Vision

The Reactive Dependency Graph evolves into:

> The Incremental Runtime Core

of the entire visual engine.

Future systems built on top of the RDG include:

- Layout engine
- Renderer scheduler
- Semantic planner
- Interaction engine
- Animation system
- Multiplayer synchronization
- AI runtime reasoning

The RDG serves as the foundational layer for all incremental runtime behavior.
