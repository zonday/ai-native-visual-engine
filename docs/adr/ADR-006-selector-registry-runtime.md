# ADR-006: Selector Registry Runtime Model

## Status

Accepted

**Date:** 2026-05

**Prerequisites:** ADR-001 (SceneGraph As SSOT)

**Related:**
- `packages/core/src/selector/selector-registry.ts` — implements this ADR
- `docs/spec/runtime-engine.md` — runtime actions and mutations
- `ADR-002` — action and history model

---

## Context

The Selector Registry evolved from a simple memoization layer into a reactive query runtime with explicit dependency tracking, lazy secondary indexes, and cache lifecycle management. This formalizes its design decisions.

### Key architecture questions

1. **Mutation ownership**: does the registry own scene mutations, or is it a pure query layer?
2. **Dependency model**: should dependencies be implicit (proxy-based) or explicit (trackField functions)?
3. **Selector semantics**: what types of selectors exist, and what contracts do they uphold?
4. **Source of truth**: when a scene mutation occurs, how does the registry stay consistent?
5. **Structural sharing**: can selectors return stable references, and under what conditions?

---

## Decision

### 1. SelectorRegistry is a query layer only

The registry does NOT own scene mutation. It reads from an external `SceneGraph` and routes signals when informed of changes.

**Layer responsibilities:**

| Layer | Owns |
|-------|------|
| SceneGraph | Data (external, mutated by action handlers) |
| Action / Patch Layer | Mutation + invalidation trigger |
| SelectorRegistry | Read + cache + signal routing + indexes |

**Contract:** callers mutate the external `SceneGraph`, then call `invalidate()` or `applyPatch()` to notify the registry. The registry never writes to `currentScene.nodes`.

**Rationale:** decouples runtime from storage. Enables time-travel, OT/CRDT, remote replay, immutable stores, and worker runtimes.

**Rejected alternative:** registry owning mutation (previous design). Coupled runtime to storage; prevented immutable-store adoption.

---

### 2. Explicit dependency declaration (no proxies)

Every selector explicitly declares its field dependencies via `trackField()` functions at the start of its compute body. No Proxy-based auto-tracking.

```ts
// Correct — explicit
getChildren(nodeId) {
  return getCached("children", nodeId, () => {
    trackChildren(nodeId);              // ← explicit declaration
    const node = currentScene.nodes[nodeId];
    ...
  }).get();
}
```

**Rationale:**
- Deterministic: every dependency is visible in the function body
- Debuggable: all signal reads are traceable
- Serializable: dependency graph can be inspected and profiled
- No ghost dependencies: no implicit tracking edge cases

**Rejected alternative:** Proxy-based auto-tracking. Made dependency graph implicit and non-debuggable; selector authors couldn't determine which signals were tracked.

---

### 3. Selector purity contract

All selector compute functions MUST be:

- **Deterministic**: same signals → same result. No `Math.random()`, `Date.now()`, or external state reads.
- **Side-effect free**: no mutation of external state during compute.
- **Read-only**: access `currentScene.nodes` only through reads (never writes).

Violations produce undefined behavior: incremental recompute becomes unreliable.

---

### 4. Structural selectors return NodeId[], not SceneNode[]

Selectors that derive _structure only_ (descendants, ancestors, etc.) return `NodeId[]` rather than `SceneNode[]`.

**Rationale:**
- Structural selectors track only topological dependencies (children, parent, tree index)
- Returning `SceneNode[]` creates a false semantic contract: consumers assume full node data is current, but the selector only guarantees structural correctness
- `NodeId[]` forces consumers to compose with field selectors (`getNode()`, `getNodeLayout()`, etc.) for data access
- Enables safe structural sharing: ID arrays are immutably comparable and never stale for their semantic domain

**Semantic categories:**

| Category | Returns | Tracks | Examples |
|----------|---------|--------|----------|
| Structural | `NodeId[]` | children/parent/tree signals | getChildren, getDescendants, getAncestors |
| Field | scalar/object | layout/props/visible signals | getNodeLayout, getNodeProps |
| Identity | `SceneNode` | structural signals (for existence) | getNode |
| Collection | array | existence signal | getAllNodes, getVisibleNodes |

---

### 5. Patch as signal routing (not mutation)

`applyPatch()` routes signals and marks indexes dirty. It does NOT mutate scene data.

```ts
applyPatch({ type: "set-prop", field: "layout", nodeId: "a" })
// → bumps layoutSignals["a"]
// → caller is responsible for scene.nodes["a"].layout = newValue
```

**Rationale:**
- Single responsibility: registry routes signals, caller manages data
- No coupling to external storage format
- Works with immutable stores, CRDTs, and remote patches

**Not a dual-write problem** because scene mutation is the authoritative write. The registry only responds to it. The caller asserts that mutation has occurred before calling `applyPatch()`.

---

### 6. Immutable SceneNode contract

`getNode()` returns the raw `SceneNode` reference from `currentScene.nodes`. Consumers MUST NOT mutate it. TypeScript `Readonly<SceneNode>` provides compile-time enforcement.

Mutation bypasses the reactive graph: `const n = registry.getNode(id); n.layout.x = 200` will NOT invalidate any selector.

**Future direction:** deep-freeze in dev mode (via `Object.freeze`) to catch violations early.

---

### 7. Subscription lifecycle

`SelectorNode.ref()` / `unref()` enables explicit lifecycle management.

When refcount drops to zero, the SelectorNode auto-disposes (frees its alien-signals computed and removes itself from the cache).

Integration target: React hooks (`useSelector`) would `ref()` on mount and `unref()` on unmount, ensuring selectors live only while observed.

Currently unintegrated. All computed cache entries persist until eviction by `enforceCacheLimit()`.

---

## Consequences

### Positive

1. Clear layer boundaries: mutation layer and query layer are independent.
2. Deterministic dependency graph: all selector dependencies are explicit.
3. Structural sharing safe within semantic domain: `NodeId[]` for structural selectors.
4. Runtime works with any storage model: immutable, CRDT, remote, etc.
5. `applyPatch()` and `invalidate()` coexist for different usage patterns.

### Tradeoffs

1. Dual-write pattern requires caller discipline: scene mutation + signal notification must stay in sync.
2. No Proxy means more boilerplate in selector definitions (explicit `trackField()` calls).
3. `NodeId[]` return types shift composition burden to consumers.
4. `Readonly<SceneNode>` is compile-time only — no runtime enforcement.

---

## Rejected Alternatives

1. **Registry-owning mutation** — Coupled runtime to storage; prevented immutable-store adoption.

2. **Proxy-based auto-tracking** — Implicit dependencies; non-debuggable; ghost dependency risk.

3. **SceneNode[] for structural selectors** — Semantic mismatch; unsafe structural sharing with mutable nodes.

4. **Deep-freezing getNode() results** — Correct but expensive; dev-mode only (deferred).
