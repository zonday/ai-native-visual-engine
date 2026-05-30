import { createReactiveSystem } from "alien-signals/system";

interface ReactiveNode {
  deps?: Link;
  depsTail?: Link;
  subs?: Link;
  subsTail?: Link;
  flags: number;
}

interface Link {
  version: number;
  dep: ReactiveNode;
  sub: ReactiveNode;
  prevSub: Link | undefined;
  nextSub: Link | undefined;
  prevDep: Link | undefined;
  nextDep: Link | undefined;
}

enum RF {
  None = 0,
  Mutable = 1,
  Watching = 2,
  RecursedCheck = 4,
  Recursed = 8,
  Dirty = 16,
  Pending = 32,
}

enum ExtraRF {
  Disposed = 128,
  Evaluating = 256,
}

export type Signal<T> = {
  (): T;
  (value: T): void;
};

type Computed<T> = (() => T) & { dispose(): void };

interface ReactiveScope {
  signal<T>(initialValue: T): Signal<T>;
  computed<T>(getter: () => T): Computed<T>;
  effect(fn: () => unknown): () => void;
  startBatch(): void;
  endBatch(): void;
  flush(): void;
}

export function createScope(): ReactiveScope {
  let cycle = 0;
  let runDepth = 0;
  let notifyIndex = 0;
  let queuedLength = 0;
  let activeSub: ReactiveNode | undefined;
  let isFlushing = false;

  const queued: (ReactiveNode | undefined)[] = [];

  // ── Known gaps ──────────────────────────────────────────────────────────
  //
  // 1. alien-signals link() — no full-chain dedup scan.
  //    If a node is read twice non-consecutively in one eval (A()+B()+A()),
  //    the second read creates a duplicate link. This causes unlink asymmetry,
  //    subs-chain length inflation, propagate overhead, and gradual graph
  //    entropy growth over many re-evals. Future: add a Set per node or scan
  //    the dep chain before linking (see alien-signals/system.mjs:18).
  //
  // 2. alien-signals checkDirty() — no visited-node tracking.
  //    A computed cycle A→B→A where both are Pending could loop infinitely.
  //    Blocked at runtime by the Evaluating-guard in oper() — no cycle ever
  //    reaches checkDirty with valid deps. Do NOT remove that guard without
  //    adding visited-node tracking to checkDirty.
  //
  // 3. Queue order (notify LIFO reversal) — alien-signals design choice.
  //    Effects are reversed within each notification group so the most-recent
  //    subscriber runs first. This is not a FIFO guarantee; cross-signal
  //    notification order is non-deterministic. Reactive systems conventionally
  //    do not order effects. No correctness impact.
  // ─────────────────────────────────────────────────────────────────────────
  const { link, unlink, propagate, checkDirty, shallowPropagate } =
    createReactiveSystem({
      update(node: ReactiveNode): boolean {
        if ("getter" in node) {
          return updateComputed(node as ComputedInternal);
        }
        if ("currentValue" in node) {
          return updateSignal(node as SignalInternal);
        }
        if ("fn" in node) {
          node.flags = RF.Mutable | RF.Dirty;
          return true;
        }
        node.flags = RF.Mutable;
        return true;
      },
      notify(effectTarget: ReactiveNode): void {
        let insertIndex = queuedLength;
        let firstInsertedIndex = insertIndex;
        do {
          queued[insertIndex++] = effectTarget;
          effectTarget.flags &= ~RF.Watching;
          const next = effectTarget.subs?.sub;
          if (next === undefined || !(next.flags & RF.Watching)) {
            break;
          }
          effectTarget = next;
        } while (notifyIndex >= 0);
        queuedLength = insertIndex;
        while (firstInsertedIndex < --insertIndex) {
          const left = queued[firstInsertedIndex];
          queued[firstInsertedIndex++] = queued[insertIndex];
          queued[insertIndex] = left;
        }
      },
      unwatched(node: ReactiveNode): void {
        if ("getter" in node) {
          if (node.depsTail !== undefined) {
            node.flags = RF.Mutable | RF.Dirty;
            let cur: Link | undefined = node.depsTail;
            while (cur !== undefined) {
              const prev: Link | undefined = cur.prevDep;
              unlink(cur, node);
              cur = prev;
            }
          }
        } else if ("currentValue" in node) {
          // signal — nothing to clean up
        } else if ("fn" in node) {
          const e = node as EffectInternal;
          if (e.cleanup) {
            try {
              e.cleanup();
            } catch {
              /* isolate cleanup error */
            }
          }
        }
      },
    });

  function purgeDeps(sub: ReactiveNode): void {
    const depsTail = sub.depsTail;
    let dep = depsTail !== undefined ? depsTail.nextDep : sub.deps;
    while (dep !== undefined) {
      dep = unlink(dep, sub);
    }
  }

  function updateComputed(c: ComputedInternal): boolean {
    if (c.flags & ExtraRF.Evaluating) {
      throw new Error(
        "[reactive-scope] Cycle detected in computed dependency graph",
      );
    }
    c.depsTail = undefined;
    c.flags = RF.Mutable | ExtraRF.Evaluating;
    const prevSub = activeSub;
    activeSub = c;
    try {
      ++cycle;
      const oldValue = c.value;
      c.value = c.getter(oldValue);
      return oldValue !== c.value;
    } finally {
      activeSub = prevSub;
      c.flags = (c.flags & ~(ExtraRF.Evaluating | RF.Pending)) | RF.Mutable;
      purgeDeps(c);
    }
  }

  function updateSignal(s: SignalInternal): boolean {
    s.flags = RF.Mutable;
    const newCurrent = s.pendingValue;
    const changed = s.currentValue !== newCurrent;
    s.currentValue = newCurrent;
    return changed;
  }

  function runEffect(e: EffectInternal): void {
    const flags = e.flags;
    if (!flags || flags & ExtraRF.Disposed) {
      return;
    }
    const isDirty = flags & RF.Dirty;
    const isPending = flags & RF.Pending;
    const hasDirtyDep =
      isPending && e.deps !== undefined && checkDirty(e.deps, e);
    if (isDirty || hasDirtyDep) {
      e.depsTail = undefined;
      purgeDeps(e);
      if (e.cleanup) {
        try {
          e.cleanup();
        } catch (err) {
          console.warn("[reactive-scope] effect cleanup error:", err);
        }
      }
      e.flags = ExtraRF.Evaluating | RF.RecursedCheck;
      const prevSub = activeSub;
      activeSub = e;
      try {
        ++cycle;
        ++runDepth;
        e.cleanup = e.fn() as (() => void) | undefined;
      } finally {
        --runDepth;
        activeSub = prevSub;
        e.flags =
          (e.flags & ~(RF.RecursedCheck | ExtraRF.Evaluating)) | RF.Watching;
        purgeDeps(e);
      }
    } else {
      e.flags = RF.Watching;
    }
  }

  function flush(): void {
    if (isFlushing) {
      return;
    }
    isFlushing = true;
    try {
      while (notifyIndex < queuedLength) {
        const effectNode = queued[notifyIndex] as EffectInternal;
        queued[notifyIndex++] = undefined;
        runEffect(effectNode);
      }
    } finally {
      isFlushing = false;
      while (notifyIndex < queuedLength) {
        const effectNode = queued[notifyIndex] as ReactiveNode;
        queued[notifyIndex++] = undefined;
        if (effectNode.flags) {
          effectNode.flags =
            (effectNode.flags & ~RF.Pending) | RF.Watching;
        }
      }
      notifyIndex = 0;
      queuedLength = 0;
    }
  }

  interface SignalInternal extends ReactiveNode {
    currentValue: unknown;
    pendingValue: unknown;
  }

  interface ComputedInternal extends ReactiveNode {
    value: unknown;
    getter: (previousValue?: unknown) => unknown;
  }

  interface EffectInternal extends ReactiveNode {
    fn: () => unknown;
    cleanup: (() => void) | undefined;
    children: EffectInternal[];
    parent: EffectInternal | undefined;
  }

  function signal<T>(initialValue: T): Signal<T> {
    const node: SignalInternal = {
      currentValue: initialValue,
      pendingValue: initialValue,
      subs: undefined,
      subsTail: undefined,
      flags: RF.Mutable,
      deps: undefined,
      depsTail: undefined,
    };

    const oper = function (this: void, ...rest: [T?]): T | undefined {
      if (rest.length !== 0) {
        const value = rest[0];
        if (node.pendingValue !== value) {
          node.pendingValue = value as unknown;
          node.flags = RF.Mutable | RF.Dirty;
          const subs = node.subs;
          if (subs !== undefined) {
            propagate(subs, !!runDepth);
            if (!batchDepth) flush();
          }
        }
      } else {
        if (node.flags & RF.Dirty) {
          if (updateSignal(node)) {
            const subs = node.subs;
            if (subs !== undefined) shallowPropagate(subs);
          }
        }
        const sub = activeSub;
        if (sub !== undefined) link(node, sub, cycle);
        return node.currentValue as T;
      }
    };
    return oper as Signal<T>;
  }

  function computed<T>(getter: () => T): Computed<T> {
    const node: ComputedInternal = {
      value: undefined,
      subs: undefined,
      subsTail: undefined,
      deps: undefined,
      depsTail: undefined,
      flags: RF.None,
      getter: getter as (previousValue?: unknown) => unknown,
    };

    const oper = (): T => {
      const flags = node.flags;
      if (flags & ExtraRF.Disposed) {
        throw new Error("[reactive-scope] Cannot read disposed computed");
      }
      if (flags & ExtraRF.Evaluating) {
        throw new Error("[reactive-scope] Cycle detected in computed");
      }
      if (flags & RF.Dirty) {
        if (updateComputed(node)) {
          const subs = node.subs;
          if (subs !== undefined) shallowPropagate(subs);
        }
      } else if (flags & RF.Pending) {
        const deps = node.deps;
        if (deps !== undefined && checkDirty(deps, node)) {
          if (updateComputed(node)) {
            const subs = node.subs;
            if (subs !== undefined) shallowPropagate(subs);
          }
        } else {
          node.flags = flags & ~RF.Pending;
        }
      } else if (!flags) {
        if (updateComputed(node)) {
          const subs = node.subs;
          if (subs !== undefined) shallowPropagate(subs);
        }
      }
      const sub = activeSub;
      if (sub !== undefined) link(node, sub, cycle);
      return node.value as T;
    };
    oper.dispose = () => {
      let cur: Link | undefined = node.depsTail;
      while (cur !== undefined) {
        const prev = cur.prevDep;
        unlink(cur, node);
        cur = prev;
      }
      cur = node.subs;
      while (cur !== undefined) {
        const next = cur.nextSub;
        unlink(cur);
        cur = next;
      }
      node.flags = ExtraRF.Disposed;
    };
    return oper;
  }

  function effect(fn: () => unknown): () => void {
    const e: EffectInternal = {
      fn,
      cleanup: undefined,
      children: [],
      subs: undefined,
      subsTail: undefined,
      deps: undefined,
      depsTail: undefined,
      flags: RF.Watching | RF.RecursedCheck,
    };

    const prevSub = activeSub;
    activeSub = e;

    if (prevSub !== undefined) {
      const parent = prevSub as EffectInternal;
      parent.children.push(e);
      e.parent = parent;
    }

    try {
      ++runDepth;
      e.cleanup = e.fn() as (() => void) | undefined;
    } finally {
      --runDepth;
      activeSub = prevSub;
      e.flags = (e.flags & ~RF.RecursedCheck) | RF.Watching;
    }

    const dispose = (): void => {
      disposeEffectNode(e);
    };

    return dispose;
  }

  function disposeEffectNode(e: EffectInternal): void {
    if (!e.flags || e.flags & ExtraRF.Disposed) {
      return;
    }
    if (e.parent) {
      const idx = e.parent.children.indexOf(e);
      if (idx !== -1) {
        e.parent.children.splice(idx, 1);
      }
    }
    e.flags = ExtraRF.Disposed;
    if (e.cleanup) {
      try {
        e.cleanup();
      } catch (err) {
        console.warn("[reactive-scope] effect cleanup error:", err);
      }
      e.cleanup = undefined;
    }
    while (e.children.length > 0) {
      disposeEffectNode(e.children[0]);
    }
    let cur: Link | undefined = e.depsTail;
    while (cur !== undefined) {
      const prev = cur.prevDep;
      unlink(cur, e);
      cur = prev;
    }
    cur = e.subs;
    while (cur !== undefined) {
      const next = cur.nextSub;
      unlink(cur);
      cur = next;
    }
  }

  let batchDepth = 0;

  function startBatch(): void {
    ++batchDepth;
  }

  function endBatch(): void {
    if (!--batchDepth) {
      flush();
    }
  }

  return { signal, computed, effect, startBatch, endBatch, flush };
}
