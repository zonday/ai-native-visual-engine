# Scheduler

## 1. Scope

Defines the mutation → compute → render pipeline. The scheduler is the orchestrator that connects the `TransactionManager`, `ComputedStateEngine`, and renderer adapter.

## 2. Principles

1. **No immediate render after mutation**. Mutations mark dirty nodes; the scheduler decides when to compute and render.
2. **Batched compute phase**. Multiple mutations within the same microtask are collapsed into a single compute pass.
3. **Deterministic phase order**. Every scheduled cycle follows: `compute → render → idle`.
4. **Renderer agnostic**. The scheduler emits events; it does not know React from Canvas.
5. **Reentrant-safe**. `markDirty` during compute/render is deferred to the next cycle, not thrown.

## 3. Interface

```ts
export type SchedulePhase = "idle" | "compute" | "render"

export interface ScheduleListener {
  onCompute?: (dirtyNodes: NodeId[]) => void
  onRender?: () => void
}

export type ScheduleMode = "microtask" | "raf" | "immediate"

export interface Scheduler {
  // — Dirty marking (called by transaction commit) —
  markDirty(nodeIds: NodeId[]): void
  markAllDirty(): void

  // — Deep flush: resolves when all pending cascading cycles are idle —
  flush(): Promise<void>

  // — Subscription —
  subscribe(listener: ScheduleListener): () => void

  // — State —
  getPhase(): SchedulePhase
  getDirtyNodes(): NodeId[]

  // — Configuration —
  setMode(mode: ScheduleMode): void
}
```

## 4. Lifecycle

```
         ┌─────────────────────────────┐
         │     Transaction Commit       │
         │   scheduler.markDirty(...)   │
         └─────────────┬───────────────┘
                       │
                       ▼
         ┌─────────────────────────────┐
         │     Schedule                 │
         │   (microtask / rAF / sync)   │
         └─────────────┬───────────────┘
                       │
                       ▼
         ┌─────────────────────────────┐
         │     Compute Phase            │
         │   onCompute(dirtyNodes)      │
         └─────────────┬───────────────┘
                       │
                       ▼
         ┌─────────────────────────────┐
         │     Render Phase             │
         │   onRender()                 │
         └─────────────┬───────────────┘
                       │
                       ▼
         ┌─────────────────────────────┐
         │    Idle                      │
         └─────────────────────────────┘
```

### 4.1 Compute Phase

1. Collect all dirty node IDs from the current dirty set.
2. Call `onCompute(dirtyNodes)` — computed state engine invalidates stale caches.
   - When `markAllDirty()` was used, `dirtyNodes` is `[]` (empty), signalling a full invalidation.
3. Dirty nodes' computed state is lazily recomputed on next read.
4. If any listener calls `markDirty(...)` during this phase, the new IDs are queued to a **pending** set and processed in the next cycle.

### 4.2 Render Phase

1. Call `onRender()` — renderer produces output (e.g., commits a frame). The dirty set is cleared before `onRender()` is called, so `getDirtyNodes()` returns `[]` during this phase.
2. If any listener calls `markDirty(...)` during this phase, the new IDs are queued to the pending set.

### 4.3 Idle

1. Dirty set is empty.
2. No pending compute or render work.
3. `flush()` resolves when the system reaches idle (including any cascading cycles from reentrant `markDirty` calls).
4. If the pending set is non-empty after a flush, a new cycle is automatically scheduled. `flush()` will also wait for that cycle before resolving.

## 5. Modes

### Microtask Mode (default)

```ts
scheduler.setMode("microtask")
```

`markDirty` schedules a microtask (via `Promise.resolve().then()`). Mutations within the same synchronous block are batched. Equivalent to the legacy `"sync"` mode — but named for the actual scheduling mechanism.

### RAF Mode (browser production)

```ts
scheduler.setMode("raf")
```

`markDirty` schedules via `requestAnimationFrame`. Multiple mutations within the same frame are batched.

### Immediate Mode (synchronous testing)

```ts
scheduler.setMode("immediate")
```

`markDirty` runs `runCycle()` synchronously. Useful for deterministic testing where no microtask boundary is desired.

## 6. Integration With TransactionManager

On every successful transaction `commit`, the caller must call `scheduler.markDirty(tx.affectedNodes)`.

The `TransactionManager` already tracks `affectedNodes` per transaction. After commit:

```ts
const result = tm.commit(tx)
if (result.ok) {
  scheduler.markDirty(tx.affectedNodes)
}
```

If `affectedNodes` is empty (e.g., `update-selection` only), the scheduler remains idle.

## 7. Factory

```ts
export function createScheduler(options?: {
  mode?: ScheduleMode
}): Scheduler
```

Default mode is `"microtask"`.

## 8. Rules

1. `markDirty` is idempotent. Calling with the same `nodeId` twice is a no-op.
2. `markAllDirty` sets the `allDirty` flag and clears the current dirty set. Subscribers receive an empty `dirtyNodes` array in `onCompute`, signalling a full invalidation.
3. During the compute or render phase, new `markDirty` calls are deferred to a **pending** set and processed in the next cycle. They MUST NOT throw.
4. The scheduler must not hold a reference to the scene. It operates on `NodeId[]` only.
5. Listeners are called synchronously during `flush()`. Listener errors are isolated per listener — a single crash does not corrupt the scheduler or silence other listeners.
6. Re-entrant cycles are bounded by `MAX_FLUSH_DEPTH` (100). Exceeding this limit throws `Maximum scheduler flush depth exceeded`. This applies both to synchronous recursion (immediate mode) and to `flush()` deep drain. On abort:
   - The scheduler clears all dirty state (`currentDirty`, `pendingDirty`, `allDirty`, `pendingAllDirty`) and returns to idle.
   - Any pending `flush()` promises are **rejected** with the depth-limit error.
   - The scheduler is fully reusable after the abort.
7. `notifyCompute` and `notifyRender` snapshot the listener array before iterating. Adding or removing listeners during a cycle does not affect the current iteration.
8. `getDirtyNodes()` returns the union of `currentDirty` and `pendingDirty` IDs. When `allDirty` (or `pendingAllDirty`) is true, the semantic "everything is dirty" signal is not reflected in the returned array — callers should check `getPhase()` or use the `onCompute([])` convention instead.
