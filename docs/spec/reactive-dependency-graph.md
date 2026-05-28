# Reactive Dependency Graph Specification

Version: 1.0
Status: Implemented
Target: AI-Native Visual Runtime Engine

---

## 1. Overview

The Reactive Dependency Graph (RDG) is the incremental computation core of the runtime engine. It transforms the runtime from a mutable JSON tree into an incremental reactive runtime.

**Responsibilities**:
- Track dependencies between source and derived state
- Propagate invalidation when source state changes
- Schedule and batch recomputation
- Enable incremental rendering

The runtime is NOT only a scene tree. It is:

```
SceneGraph
  +
DependencyGraph
```

---

## 2. Goals

The RDG must support:
- Fine-grained incremental updates
- Derived / computed state
- Dirty propagation
- Automatic dependency tracking
- Incremental rendering
- Scheduler integration
- Deterministic recomputation
- Renderer-independent runtime computation

### Non-Goals

The RDG is NOT responsible for:
- History / undo-redo
- Collaboration / CRDT
- Persistence
- Semantic planning
- Renderer implementation

These systems consume RDG outputs but are not part of the graph itself.

---

## 3. Architecture

### 3.1 Graph Layers

```
SceneGraph
  ->
Reactive Dependency Graph
  ->
Scheduler
  ->
Renderer
```

### 3.2 Scope Isolation

Every reactive system is created via `createScope()`, which calls `createReactiveSystem` from `alien-signals` internally. Each scope returns a triple of primitives (`signal`, `computed`, `effect`) plus batching controls (`startBatch`, `endBatch`).

```ts
interface ReactiveScope {
  signal<T>(initial: T): Signal<T>
  computed<T>(fn: () => T): Computed<T>
  effect(fn: () => void | (() => void)): () => void  // returns dispose
  startBatch(): void
  endBatch(): void
  flush(): void       // runs pending effects
}
```

**Scope isolation is the key architectural decision**: each subsystem (selector caching, computed properties, render subscriptions) gets its own independent reactive scope. Signals in scope A never trigger computeds in scope B, preventing cross-contamination.

### Cross-Scope Communication

Scope isolation means **reactive dependency edges do NOT cross scope boundaries**. When engine computeds call selector methods, they receive values but do NOT register as reactive subscribers of selector signals. The `activeSub` pointer is per-scope, so `link()` in the callee's scope cannot see the caller's `activeSub`.

Cross-scope invalidation mechanisms:

| Mechanism | Scope crossing | How it works |
|-----------|---------------|--------------|
| `engine.invalidate(nodeId)` | Engine → cache | Deletes cached computeds for node; next access creates fresh computed |
| `clearIfStale()` (scene version) | Selector → Engine | Polls `selectors.getVersion()`; when scene version changes, all engine caches clear |
| `selector.invalidate(nodeId)` | Selector only | Bumps version signal within selector scope; marks selector computeds dirty (does NOT cross to engine) |

For mutations that must propagate from selector to engine, callers MUST call `engine.invalidate(nodeId)` after `selector.invalidate(nodeId)`, or use `invalidateAll()` on both for full resets.

Current scopes:
| Scope | Owner | Purpose |
|-------|-------|---------|
| SelectorRegistry | `createScope()` | Per-node version signals + selector computeds |
| ComputedStateEngine | `createScope()` | Per-node version signals + computed property chains |
| Renderer (future) | `createScope()` | Effect subscriptions for dirty subtree rendering |

### 3.3 Reactive Node Types

Every node in the graph shares a common shape:

```ts
interface ReactiveNode {
  flags: number           // Mutable | Dirty | Watching | Pending | RecursedCheck | Recursed
  subs?: Link             // linked list of dependents
  subsTail?: Link
  deps?: Link             // linked list of dependencies
  depsTail?: Link
}
```

#### Source Nodes (Signal)

Mutable runtime state that originates from transactions. Examples: `node.props`, `node.transform`, `node.layout`.

```ts
interface SignalInternal extends ReactiveNode {
  currentValue: unknown
  pendingValue: unknown
}
```

#### Computed Nodes

Derived values that are lazily recomputed. Examples: `worldTransform`, `computedBounds`, `visibleBounds`, `selectionBounds`.

```ts
interface ComputedInternal extends ReactiveNode {
  value: unknown
  getter: (previousValue?: unknown) => unknown
}
```

#### Effect Nodes

Trigger runtime side effects. Examples: render invalidation, overlay updates, hit-test refresh.

```ts
interface EffectInternal extends ReactiveNode {
  fn: () => void | (() => void)
  cleanup: (() => void) | undefined
}
```

### 3.4 Edge Storage

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

This avoids the allocation and iteration overhead of `Set`-based edge storage.

---

## 4. Primitives

The graph is built on three primitives, provided by a scoped `alien-signals` system via `createReactiveSystem`.

### 4.1 Signal (Source Node)

A callable value holder.

```ts
interface Signal<T> {
  (): T        // getter — tracks caller as dependent
  (v: T): void // setter — marks dependents dirty
}
```

- **Getter**: returns current value; if called inside a `Computed` getter, registers an edge via `link()`.
- **Setter**: stores new value in `pendingValue`; if value differs, calls `propagate` to walk subscriber list.

### 4.2 Computed (Derived Node)

A lazily evaluated derived value.

```ts
type Computed<T> = () => T
```

- **First access**: evaluates getter, caches result, records all `Signal`/`Computed` reads as dependencies via `activeSub` tracking.
- **Subsequent access**: if no dependency has changed, returns cached value.
- **Dependency changed**: marked dirty, re-evaluates on next access.

### 4.3 Effect (Side-Effect Node)

A callback that runs when its dependencies change.

```ts
type Effect = () => void | (() => void)  // return value is a cleanup function
```

- Runs once per batch, not per dependency change.
- Supports cleanup functions for tearing down subscriptions.
- Returns a dispose function to unsubscribe.

---

## 5. Dependency Tracking

### 5.1 Mechanism

Dependencies are tracked **automatically** during computed/effect getter execution.

When a `Computed` evaluates its getter:

1. It sets a global `activeSub` pointer to itself.
2. Any `Signal()` or `Computed()` call inside the getter reads `activeSub` and calls `link(dep, sub, cycle)`, which appends an edge to both the dep's subscriber list and the sub's dependency list.
3. After evaluation, `activeSub` is restored and unused deps are purged.

### 5.2 Example

```ts
const moveX = signal(100)
const moveY = signal(50)
const width = signal(200)
const height = signal(100)

const worldTransform = scope.computed(() => ({
  x: moveX(),
  y: moveY(),
  rotation: 0,
  scaleX: 1,
  scaleY: 1,
}))

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

### 5.3 Edge Direction

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

### 5.4 Cycles

Dependency cycles are **forbidden**. If a computed reads itself (transitively), `alien-signals` detects the cycle via recursion depth and produces undefined behavior.

```ts
// INVALID: A -> B -> C -> A
```

Callers must ensure acyclic graphs.

---

## 6. Dirty Propagation

### 6.1 Mutation Path

A transaction mutates source state. The RDG reacts:

```
transaction
  ->
source mutation (signal.set)
  ->
dirty propagation
  ->
scheduler
  ->
recompute
```

### 6.2 Signal Set

```ts
moveX(200)
```

1. `moveX` stores `pendingValue = 200`, sets flag `Mutable | Dirty`.
2. Calls `propagate(moveX.subs, isInnerWrite)`.
3. `propagate` walks the subscriber list; for each `ComputedNode`, calls `update(computed)`.
4. `update` re-evaluates getter, compares old vs new value.
5. If value changed, continues propagation to subscribers.
6. If value unchanged, propagation stops (no cascading).

### 6.3 Lazy Recompute

Dirty nodes MUST NOT recompute immediately. Dirty computeds are re-evaluated on the next `.get()` call — unless an `effect` is waiting, in which case the effect's `fn` runs during `flush()`.

### 6.4 Batching

Between `startBatch()` / `endBatch()`, writes accumulate without intermediate flushes:

```ts
startBatch()
moveX(200)
moveY(100)
endBatch()  // single flush pass
```

Multiple mutations MUST be batched:

```ts
// Forbidden:
mutation -> immediate recompute

// Required:
multiple mutations -> single recompute pass
```

---

## 7. Scheduler Integration

### 7.1 Scheduler Role

The scheduler coordinates recomputation phases. When effects are dirty, the scheduler calls `scope.flush()` in its compute phase. This runs all pending effects exactly once, regardless of how many sources changed.

### 7.2 Runtime Phases

Recommended phases (defined by the scheduler, not the RDG):

| Phase | Description |
|-------|-------------|
| Transaction | Apply mutations from command bus |
| Dirty propagation | Mark affected computed nodes dirty |
| Computed | Re-evaluate dirty computeds on demand |
| Layout | Run layout engine (future) |
| Render | Trigger render effects for dirty subtrees |
| Overlay | Update selection / snap / hover overlays |

The RDG itself only handles dirty propagation and lazy recomputation. Phase orchestration is the scheduler's responsibility.

### 7.3 Scheduler Flow

```
transaction
  ->
source mutation
  ->
mark dirty
  ->
scheduler flush
  ->
recompute computed nodes (lazy)
  ->
emit render invalidation (via effects)
  ->
renderer update
```

---

## 8. Integration Points

### 8.1 Selector System

Selectors are graph entry points — the unified, memoized access layer for reading `SceneGraph`.

**禁止**: `scene.nodes[id]` in business logic.
**必须**: `selector.getNode(id)`.

#### SelectorRegistry Interface

```ts
export interface SelectorRegistry {
  // — Node accessors —
  getNode(nodeId: NodeId): SceneNode | undefined
  getNodeUnsafe(nodeId: NodeId): SceneNode
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

#### RDG Integration

Each `SelectorRegistry` creates its own scope. Every selector method registers dependencies via a **version-signal pattern**: per-node `signal<number>` acts as a dirty counter.

```
node:a:version  →  getNode('a')
node:a:version  →  children:root  (cached children list)
node:a:version  →  parent:a  (cached parent lookup)
```

When `invalidate(nodeId)` is called, the node's version signal is incremented. All computed selectors that read that signal are marked dirty and re-evaluate on next access.

```ts
getChildren(nodeId: NodeId): SceneNode[] {
  checkVersion()
  return getCached(`children:${nodeId}`, () => {
    getVersionSignal(nodeId)()       // read — registers dependency
    const node = scene.nodes[nodeId] // direct read (already tracked via signal)
    if (!node?.children) return []
    return node.children
      .map((id) => registry.getNode(id))
      .filter((n): n is SceneNode => n !== undefined)
  })()
}
```

### 8.2 ComputedStateEngine

Each `ComputedStateEngine` creates its own scope. Every computed property (`getWorldTransform`, `getComputedBounds`, etc.) is a `Computed` that reads selector `Computed`s and other engine `Computed`s:

Engine computeds subscribe to **selector version signals** (via `selectors.getNode()`, `selectors.getParent()`). When a selector signal is bumped via `selector.invalidate(nodeId)`, the dirty state propagates through the engine's computed chain. The engine also provides a direct `invalidate(nodeId)` that deletes cached computations for a specific node, forcing a fresh computed on the next access.

`checkVersion()` / `clearIfStale()` handles scene version changes: when `selectors.getVersion()` differs from the cached version, all engine caches are cleared, ensuring consistency after a full scene replacement.

```ts
export function createComputedStateEngine(
  selectors: SelectorRegistry,
): ComputedStateEngine {
  const { computed } = createScope()
  const worldCache = new Map<NodeId, () => WorldTransform>()
  // ... other computed caches
  let lastVersion = selectors.getVersion()

  function clearIfStale(): void {
    const currentVersion = selectors.getVersion()
    if (currentVersion === lastVersion) return
    lastVersion = currentVersion
    worldCache.clear()
    boundsCache.clear()
    // ... clear all caches
  }

  const engine = {
    getWorldTransform(nodeId: NodeId): WorldTransform {
      clearIfStale()
      let c = worldCache.get(nodeId)
      if (!c) {
        c = computed(() => {
          const node = selectors.getNode(nodeId)     // depends on selector signal
          const parent = selectors.getParent(nodeId)  // depends on selector signal
          if (!parent) return /* root transform */
          const parentTx = engine.getWorldTransform(parent.id) // depends on parent computed
          return /* accumulated transform */
        })
        worldCache.set(nodeId, c)
      }
      return c()
    },

    invalidate(nodeId: NodeId): void {
      // Delete specific node's cache entries
      worldCache.delete(nodeId)
      boundsCache.delete(nodeId)
      centerCache.delete(nodeId)
      localCache.delete(nodeId)
    },
    // ...
  }
  return engine
}
```

Dependency chain:

```
node:a:version (selector)  →  world:a (engine computed)
world:a                    →  world:a1 (engine computed)
world:a1                   →  bounds:a1 (engine computed)
```

**Computed values MUST NOT be written back into SceneGraph.**

```ts
// INVALID:
node.worldTransform = engine.getWorldTransform(id)
```

### 8.3 Renderer

The renderer subscribes via `effect()` to re-render only the dirty subtree:

```ts
scope.effect(() => {
  const bounds = engine.getComputedBounds(nodeId)
  // re-render React component if bounds changed
})
```

The renderer MUST NOT directly traverse mutable scene state. It consumes computed runtime outputs.

Render invalidation MUST be incremental:

```ts
// INVALID: whole scene rerender
// REQUIRED: dirty subtree rerender
```

### 8.4 Interaction Systems

Interaction subsystems depend on computed runtime state:

- Hit testing → `engine.getComputedBounds(nodeId)`
- Selection → `selectors.getNode(nodeId)`, `engine.getWorldTransform(nodeId)`
- Snap lines → `engine.getEdge(nodeId, ...)`
- Hover overlays → `engine.getVisibleBounds(nodeId)`

All interaction systems MUST consume selectors and computed nodes, never raw `SceneGraph` access.

### 8.5 Transaction Integration

Transactions mutate source state through the command bus. The RDG reacts to mutations:

```
command bus dispatch
  ->
selector.invalidate(nodeId)   // bump version signal
  ->
lazy recompute on next access
  ->
render effect triggers
```

---

## 9. Correctness Guarantees

| Guarantee | Mechanism |
|-----------|-----------|
| No stale reads | Dirty computeds re-evaluate before returning |
| Deterministic order | Topological order via propagate chain |
| No glitches | Signal writes during getter are queued, not applied |
| No cycles | Cycle detection via recursion guard |
| Scope isolation | Each scope has independent graph |
| No hidden mutable derived state | Computed values never written back to SceneGraph |
| Stable dependency registration | Link-based edges persist across evaluations until explicitly purged |

---

## 10. Memory Model

### 10.1 Cached Values

Computed values are cached in their respective `Map<NodeId, Computed<T>>` structures. Unused computed nodes MAY be garbage-collected when their cache map entry is deleted.

### 10.2 Weak References (Future)

Dependency edges currently use strong references via the `Link` linked list. Weak reference support is deferred — all current subscribers and dependencies have explicit lifecycle management (scope dispose, `invalidateAll`, `sync`).

---

## 11. Debugging Interface

The scope MAY expose debugging tools (not yet implemented):

```ts
interface DebugScope {
  getGraph(): { nodes: ReactiveNode[]; edges: Link[] }
  onRecompute(fn: (key: string) => void): () => void
}
```

Recommended debugging capabilities:
- Dependency graph visualization
- Dirty graph visualization
- Recompute tracing
- Scheduler timeline
- Selector hit/miss tracing

---

## 12. Non-Goals (Phase 1)

- Distributed / cross-runtime graph sync
- CRDT-backed dependency resolution
- Async dependency resolution
- Persisted dependency graph
- Automatic `effect` cleanup (caller disposes)
- Weak reference edges

---

## 13. Performance Goals

The RDG should optimize for:
- Minimal recomputation (only dirty subgraph)
- Minimal rerendering (only dirty subtrees)
- Stable cache locality (intrusive linked lists, no hash set iteration)
- Predictable invalidation cost (O(dirty subgraph), not O(graph))

---

## 14. Implementation Decision: alien-signals

### 14.1 Why alien-signals

The RDG is built on [`alien-signals`](https://github.com/stackframe-projects/alien-signals) `createReactiveSystem`, chosen for:

| Factor | alien-signals | Vue reactivity | Preact signals | MobX |
|--------|---------------|----------------|----------------|------|
| Scope isolation | First-class (`createReactiveSystem`) | Per-component | Global | Global |
| Edge storage | Intrusive linked list | Array | Array | Set |
| Bundle size | ~1 KB | ~15 KB | ~2 KB | ~12 KB |
| TypeScript strict | Yes | Partial | Yes | Partial |
| Framework-agnostic | Yes | Vue-coupled | Preact-coupled | Yes |

### 14.2 Scope Isolation Rationale

Each subsystem gets its own `createReactiveSystem` scope to prevent:
- Selector cache misses from dirtying computed properties
- Render subscriptions from interfering with selector caching
- Cross-talk between independent consumers

---

## 15. Long-Term Vision

The Reactive Dependency Graph becomes the Incremental Runtime Core of the entire visual engine. Future systems built on top include:

- Layout engine (incremental layout computation)
- Renderer scheduler (dirty subtree rendering)
- Semantic planner (AI-driven intent resolution)
- Interaction engine (hit-testing, drag, snap)
- Animation system (time-driven computed values)
- Multiplayer sync (remote mutation integration)
- AI runtime reasoning (reactive plan execution)

The RDG is the foundational layer for all incremental runtime behavior.

---

## 16. Open Questions

1. Should `effect` cleanup be automatic (scope dispose) or manual? (Current: manual via returned dispose function.)
2. Should `ComputedStateEngine` share the SelectorRegistry's scope or create its own? (Current: own scope, to prevent selector cache misses from dirtying computed properties.)
3. How should viewport-dependent `Computed`s (e.g., `getVisibleBounds` with viewport rect) be invalidated — parameterized cache keys or scope per viewport?

---

## Appendix A: Recommended Package Structure

```
packages/core/
  src/
    deps/
      reactive-scope.ts        # createScope() — createReactiveSystem wrapper
    selector/
      selector-registry.ts     # SelectorRegistry with version-signal pattern
    computed/
      computed-state-engine.ts # ComputedStateEngine with computed property chains
```

## Appendix B: Data Flow Diagram

```
Command Bus
    │
    ▼
SelectorRegistry.invalidate(nodeId)
    │  (bumps version signal)
    ▼
Signal (version) ──propagate──► Computed (selector) ──propagate──► Computed (engine)
                                                                        │
                                                                        ▼
                                                                   Effect (render)
                                                                        │
                                                                        ▼
                                                                   Renderer update
```
