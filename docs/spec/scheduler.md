# Scheduler

## 1. Scope

Defines the mutation → compute → render pipeline. The scheduler is the orchestrator that connects the `TransactionManager`, `ComputedStateEngine`, and renderer adapter.

## 2. Principles

1. **No immediate render after mutation**. Mutations mark dirty nodes; the scheduler decides when to compute and render.
2. **Batched compute phase**. Multiple mutations within the same microtask are collapsed into a single compute pass.
3. **Deterministic phase order**. Every scheduled cycle follows: `compute → render → idle`.
4. **Renderer agnostic**. The scheduler emits events; it does not know React from Canvas.

## 3. Interface

```ts
export type SchedulePhase = 'compute' | 'render' | 'idle'

export interface ScheduleListener {
  onBeforeCompute?: (dirtyNodes: NodeId[]) => void
  onAfterCompute?: (dirtyNodes: NodeId[]) => void
  onBeforeRender?: () => void
  onAfterRender?: () => void
}

export interface Scheduler {
  // — Dirty marking (called by transaction commit) —
  markDirty(nodeIds: NodeId[]): void
  markAllDirty(): void

  // — Manual flush (sync mode) —
  flush(): Promise<void>

  // — Subscription —
  subscribe(listener: ScheduleListener): () => void

  // — State —
  getPhase(): SchedulePhase
  getDirtyNodes(): NodeId[]

  // — Configuration —
  setMode(mode: 'sync' | 'async'): void
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
         │     Schedule Microtask       │
         │   (Promise.then / rAF)       │
         └─────────────┬───────────────┘
                       │
          ┌────────────┴────────────┐
          ▼                         ▼
  ┌──────────────┐       ┌──────────────────┐
  │  Compute Phase │       │  If sync mode:   │
  │  invalidate()  │       │  immediate run   │
  │  recompute()   │       └──────────────────┘
  └───────┬───────┘
          │
          ▼
  ┌──────────────┐
  │  Render Phase │
  │  notify()     │
  └───────┬───────┘
          │
          ▼
  ┌──────────────┐
  │    Idle      │
  └──────────────┘
```

### 4.1 Compute Phase

1. Collect all dirty node IDs from the dirty set.
2. Call `onBeforeCompute(dirtyNodes)` — computed state engine invalidates stale caches.
3. Dirty nodes' computed state is lazily recomputed on next read.
4. Call `onAfterCompute(dirtyNodes)` — subscribers (e.g., renderer) are notified.

### 4.2 Render Phase

1. Call `onBeforeRender()` — renderer prepares for a new frame.
2. Renderer reads latest scene via selectors and computed state engine.
3. Call `onAfterRender()` — renderer commits.

### 4.3 Idle

1. Dirty set is empty.
2. No pending compute or render work.

## 5. Modes

### Sync Mode (default for testing)

```ts
scheduler.setMode('sync')
```

`markDirty` immediately schedules a microtask (via `Promise.resolve().then()`). For synchronous test environments, call `scheduler.flush()` explicitly.

### Async Mode (browser production)

```ts
scheduler.setMode('async')
```

`markDirty` schedules via `requestAnimationFrame`. Multiple mutations within the same frame are batched.

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
  mode?: 'sync' | 'async'
}): Scheduler
```

## 8. Rules

1. `markDirty` is idempotent. Calling with the same `nodeId` twice is a no-op.
2. `markAllDirty` clears the dirty set and replaces it with `allNodeIds`.
3. During the compute phase, new mutations MUST NOT occur. If they do, the scheduler throws.
4. The scheduler must not hold a reference to the scene. It operates on `NodeId[]` only.
5. Listeners are called synchronously during `flush()`.
