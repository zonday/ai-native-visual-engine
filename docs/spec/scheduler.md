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
  onCompute?: (dirtyNodes: NodeId[], all?: boolean) => void
  onRender?: () => void
}

export type ScheduleMode = "microtask" | "raf" | "immediate"

export interface Scheduler {
  // — Dirty marking (called by transaction commit) —
  markDirty(nodeIds: NodeId[]): void
  markAllDirty(): void

  // — Deep flush: resolves when all cascading cycles are idle —
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

1. At cycle start, the current dirty set is **captured and cleared**, so reentrant `markDirty` calls during this phase are written to a fresh set and processed in the next cycle.
2. Call `onCompute(dirtyNodes, all?)` — computed state engine invalidates stale caches.
   - When `markAllDirty()` was used, `all` is `true` and `dirtyNodes` is `[]` (empty).
   - When specific nodes were marked, `all` is `false` or `undefined`, and `dirtyNodes` contains the invalidated node IDs.
3. If any listener calls `markDirty(...)` during this phase, the new IDs are written to the fresh current set and processed in the next cycle.

### 4.2 Render Phase

1. Call `onRender()` — renderer produces output (e.g., commits a frame). The dirty set was cleared at the start of the cycle, so `getDirtyNodes()` returns `[]` during this phase.
2. If any listener calls `markDirty(...)` during this phase, the new IDs are written to the current set and processed in the next cycle.

### 4.3 Idle

1. Dirty set is empty.
2. `flush()` resolves when the system reaches idle (including any cascading cycles from reentrant `markDirty` calls).
3. If the current set is non-empty after a cycle, a new cycle is automatically scheduled.

## 5. Modes

### Microtask Mode (default)

```ts
scheduler.setMode("microtask")
```

`markDirty` schedules a microtask (via `Promise.resolve().then()`). Mutations within the same synchronous block are batched.

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
3. During the compute or render phase, new `markDirty` calls are written to the current set and processed in the next cycle. They MUST NOT throw.
4. The scheduler must not hold a reference to the scene. It operates on `NodeId[]` only.
5. Listeners are called synchronously during `flush()`. Listener errors are isolated per listener — a single crash does not corrupt the scheduler or silence other listeners.
6. **Epoch-based flush resolution.** Every cycle increments an internal epoch counter. Flush requests are bound to the epoch at creation time; only requests whose epoch ≤ the current epoch are resolved in each cycle's finally block. This prevents stale or out-of-order resolution in deep-flush loops.
7. Re-entrant cycles are bounded by `MAX_FLUSH_DEPTH` (100). Exceeding this limit throws `Maximum scheduler flush depth exceeded`. This applies both to synchronous recursion (immediate mode) and to `flush()` deep drain. On abort:
   - The scheduler clears all dirty state and returns to idle.
   - Any pending `flush()` promises are **rejected** with the depth-limit error.
   - The scheduler is fully reusable after the abort.
8. `notifyCompute` and `notifyRender` snapshot the listener array before iterating. Adding or removing listeners during a cycle does not affect the current iteration.
9. `getDirtyNodes()` returns only the current dirty set (no separate pending set). When `allDirty` is true, `getDirtyNodes()` returns `[]` — listeners can distinguish partial from full invalidation via the `all` parameter on `onCompute`.
10. `flush()` is a **strict quiescence barrier**: it only resolves when the scheduler is idle AND no microtask or rAF callback is pending. The internal `scheduled` flag tracks whether a scheduling callback is queued; `flush()` checks it before resolving.
