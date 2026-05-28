# Reactive Dependency Graph Specification

Version: 1.0
Target: AI-Native Visual Runtime Engine

---

## 1. Problem

The runtime reads `SceneGraph` to compute derived state: world transforms, layout bounds, visibility, selection geometry. Today every mutation either clears all caches (`invalidateAll`) or manually walks known cache keys. This does not scale — a single property change on one node should not invalidate unrelated computed data.

**Goal**: a dependency graph that tracks which source data feeds which computed values, so that a mutation only dirties the affected subgraph.

---

## 2. Primitives

The graph is built on three primitives, provided by a scoped `alien-signals` system via `createReactiveSystem`:

### 2.1 Signal (Source Node)

A callable value holder.

```ts
interface Signal<T> {
  (): T        // getter — tracks caller as dependent
  (v: T): void // setter — marks dependents dirty
}
```

- Getter: returns current value; if called inside a `Computed` getter, registers an edge.
- Setter: stores new value; if value differs, walks subscriber list via `propagate`.

### 2.2 Computed (Derived Node)

A lazily evaluated derived value.

```ts
type Computed<T> = () => T
```

- On first access: evaluates getter, caches result, records all `Signal`/`Computed` reads as dependencies.
- On subsequent access: if no dependency has changed, returns cached value.
- When a dependency changes: marked dirty, re-evaluates on next access.

### 2.3 Effect (Side-Effect Node)

A callback that runs when its dependencies change.

```ts
type Effect = () => void
```

- Registered during scheduler flush.
- Runs once per batch, not per dependency change.

---

## 3. Architecture

### 3.1 Scope

Every reactive system is created via `createScope()`, which calls `createReactiveSystem` internally and returns a **triple of the three primitives**:

```ts
interface ReactiveScope {
  signal<T>(initial: T): Signal<T>
  computed<T>(fn: () => T): Computed<T>
  effect(fn: () => void): Effect
}
```

Each scope is fully isolated — signals in scope A never trigger computeds in scope B.

Scope isolation is the key architectural decision: it prevents cross-contamination between different subsystems (selector caching vs computed properties vs render subscriptions).

### 3.2 Node Types

Every node in the graph has a common shape:

```ts
interface ReactiveNode {
  flags: number           // Mutable | Dirty | Watching | Pending
  subs?: Link             // linked list of dependents
  subsTail?: Link
  deps?: Link             // linked list of dependencies
  depsTail?: Link
}
```

- **SignalNode** extends ReactiveNode with `currentValue` and `pendingValue`.
- **ComputedNode** extends ReactiveNode with `value` and `getter`.
- **EffectNode** extends ReactiveNode with `fn`.

Edges are stored as **intrusive doubly-linked lists** (no allocation per edge traversal):

```ts
interface Link {
  version: number
  dep: ReactiveNode
  sub: ReactiveNode
  prevSub: Link | undefined
  nextSub: Link | undefined
  prevDep: Link | undefined
  nextDep: Link | undefined
}
```

### 3.3 Edge Direction

Edges point from **source → dependent** (signal → computed, computed → computed, computed → effect).

```
localTransform
    ↓
worldTransform
    ↓
layoutBounds
    ↓
renderEffect
```

---

## 4. Dependency Tracking

Dependencies are tracked **automatically** during computed/effect getter execution.

### 4.1 Mechanism

When `Computed` evaluates its getter:

1. It sets a global `activeSub` pointer to itself.
2. Any `Signal()` or `Computed()` call inside the getter reads `activeSub` and calls `link(dep, sub, cycle)`, which appends an edge to both the dep's subscriber list and the sub's dependency list.
3. After evaluation, `activeSub` is restored and unused deps are purged.

### 4.2 Example

```ts
const moveX = signal(100)
const moveY = signal(50)
const width = signal(200)
const height = signal(100)

const worldTransform = scope.computed(() => {
  return {
    x: moveX(),
    y: moveY(),
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
  }
})

const bounds = scope.computed(() => {
  const t = worldTransform()
  return { x: t.x, y: t.y, width: width(), height: height() }
})
```

Edges registered:

```
moveX  →  worldTransform
moveY  →  worldTransform
width  →  bounds
worldTransform  →  bounds
```

### 4.3 Cycles

Cycles are prohibited. If a computed reads itself (transitively), alien-signals detects the cycle via recursion depth and produces undefined behavior. Callers must ensure acyclic graphs.

---

## 5. Dirty Propagation

### 5.1 Signal Set

```ts
moveX(200)
```

1. `moveX` stores `pendingValue = 200`, sets flag `Mutable | Dirty`.
2. Calls `propagate(moveX.subs, isInnerWrite)`.
3. `propagate` walks the subscriber list; for each `ComputedNode`, calls `update(computed)`.
4. `update` calls `updateComputed` → re-evaluates getter, compares old value vs new value.
5. If value changed, continues propagation to the computed's subscribers (e.g., `bounds`).
6. If value unchanged, propagation stops (no cascading to `bounds`).

### 5.2 Lazy

Dirty computeds are **not** re-evaluated immediately during propagate. They are re-evaluated on the next `.get()` call — unless an `effect` is waiting, in which case the effect's `fn` runs during `flush()`.

### 5.3 Batching

Between `startBatch()` / `endBatch()`, writes accumulate without intermediate flushes:

```ts
startBatch()
moveX(200)
moveY(100)
endBatch()  // single flush pass
```

This avoids redundant re-evaluations when multiple sources change together.

---

## 6. Integration Points

### 6.1 SelectorRegistry

Each `SelectorRegistry` creates its own scope. Every selector method is a `Computed` that reads version `Signal`s:

```
node:a:version  →  node:a  (cached node access)
node:a:version  →  children:root  (cached children list)
node:a:version  →  parent:a  (cached parent lookup)
```

When a mutation occurs, the node's version signal is incremented. All selectors that read that signal are marked dirty and re-evaluate on next access.

### 6.2 ComputedStateEngine

Each `ComputedStateEngine` creates its own scope. Every computed property (`getWorldTransform`, `getComputedBounds`, etc.) is a `Computed` that reads selector `Computed`s and its own version `Signal`s:

```
node:a1:version  →  world:a  (via selector)
world:a  →  world:a1  (via engine.getWorldTransform recursion)
world:a1  →  bounds:a1  (via engine.getComputedBounds)
```

### 6.3 Renderer

The renderer subscribes via `effect()` to re-render only the dirty subtree:

```ts
scope.effect(() => {
  const bounds = engine.getComputedBounds(nodeId)
  // re-render if bounds changed
})
```

### 6.4 Scheduler

The scheduler calls `scope.flush()` in its compute phase. This runs all pending effects exactly once, regardless of how many sources changed.

---

## 7. Correctness Guarantees

| Guarantee | Mechanism |
|-----------|-----------|
| No stale reads | Dirty computeds re-evaluate before returning |
| Deterministic order | Topological order via propagate chain |
| No glitches | Signal writes during getter are queued, not applied |
| No cycles | Cycle detection via recursion guard |
| Isolation | Each scope has independent graph |

---

## 8. Non-Goals (Phase 1)

- Distributed / cross-runtime graph sync
- CRDT-backed dependency resolution
- Async dependency resolution
- Persisted dependency graph
- Automatic `effect` cleanup (caller disposes)

---

## 9. Debugging Interface

The scope may expose:

```ts
interface DebugScope {
  getGraph(): { nodes: ReactiveNode[], edges: Link[] }
  onRecompute(fn: (key: string) => void): () => void
}
```

Not yet implemented.

---

## 10. Open Questions

1. Should `effect` cleanup be automatic (scope dispose) or manual?
2. Should `ComputedStateEngine` share the SelectorRegistry's scope or create its own? (Currently: own scope, to prevent selector cache misses from dirtying computed properties.)
3. How should viewport-dependent `Computed`s (e.g., `getVisibleBounds` with viewport rect) be invalidated — parameterized cache keys or scope per viewport?
