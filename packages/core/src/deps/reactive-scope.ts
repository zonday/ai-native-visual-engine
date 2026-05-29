import { createReactiveSystem } from "alien-signals/system";

export interface ReactiveNode {
  deps?: Link;
  depsTail?: Link;
  subs?: Link;
  subsTail?: Link;
  flags: number;
}

export interface Link {
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

export type Signal<T> = {
  (): T;
  (value: T): void;
};

export type Computed<T> = () => T;

export type Effect = () => void;

export interface ReactiveScope {
  signal<T>(initialValue: T): Signal<T>;
  computed<T>(getter: () => T): Computed<T>;
  effect(fn: () => unknown): () => void;
  startBatch(): void;
  endBatch(): void;
  flush(): void;
}

export function createScope(): ReactiveScope {
  const HasChildEffect = 64;
  let cycle = 0;
  let runDepth = 0;
  let notifyIndex = 0;
  let queuedLength = 0;
  let activeSub: ReactiveNode | undefined;

  const queued: (ReactiveNode | undefined)[] = [];

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
    if (c.flags & HasChildEffect) {
      let link = c.depsTail;
      while (link !== undefined) {
        const prev: Link | undefined = link.prevDep;
        const dep = link.dep;
        if (!("getter" in dep) && !("currentValue" in dep)) {
          unlink(link, c);
        }
        link = prev;
      }
    }
    c.depsTail = undefined;
    c.flags = RF.Mutable | RF.Watching;
    const prevSub = activeSub;
    activeSub = c;
    try {
      ++cycle;
      const oldValue = c.value;
      c.value = c.getter(oldValue);
      return oldValue !== c.value;
    } finally {
      activeSub = prevSub;
      c.flags &= ~RF.Watching;
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
    const isDirty = flags & RF.Dirty;
    const isPending = flags & RF.Pending;
    const hasDirtyDep =
      isPending && e.deps !== undefined && checkDirty(e.deps, e);
    if (isDirty || hasDirtyDep) {
      if (e.cleanup) {
        try {
          e.cleanup();
        } catch (err) {
          console.warn("[reactive-scope] effect cleanup error:", err);
        }
      }
      e.depsTail = undefined;
      e.flags = RF.Watching | RF.RecursedCheck;
      const prevSub = activeSub;
      activeSub = e;
      try {
        ++cycle;
        ++runDepth;
        e.cleanup = e.fn() as (() => void) | undefined;
      } finally {
        --runDepth;
        activeSub = prevSub;
        e.flags &= ~RF.RecursedCheck;
        purgeDeps(e);
      }
    } else if (e.deps !== undefined) {
      e.flags = RF.Watching | (flags & HasChildEffect);
    }
  }

  function flush(): void {
    try {
      while (notifyIndex < queuedLength) {
        const effectNode = queued[notifyIndex] as EffectInternal;
        queued[notifyIndex++] = undefined;
        runEffect(effectNode);
      }
    } finally {
      while (notifyIndex < queuedLength) {
        const effectNode = queued[notifyIndex] as ReactiveNode;
        queued[notifyIndex++] = undefined;
        effectNode.flags |= RF.Watching;
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
        node.flags = RF.Mutable | RF.Watching;
        const prevSub = activeSub;
        activeSub = node;
        try {
          node.value = node.getter();
        } finally {
          activeSub = prevSub;
          node.flags &= ~RF.Watching;
        }
      }
      const sub = activeSub;
      if (sub !== undefined) link(node, sub, cycle);
      return node.value as T;
    };
    return oper;
  }

  function effect(fn: () => unknown): () => void {
    const e: EffectInternal = {
      fn,
      cleanup: undefined,
      subs: undefined,
      subsTail: undefined,
      deps: undefined,
      depsTail: undefined,
      flags: RF.Watching | RF.RecursedCheck,
    };

    const prevSub = activeSub;
    activeSub = e;

    if (prevSub !== undefined) {
      link(e, prevSub, 0);
      prevSub.flags |= HasChildEffect;
    }

    try {
      ++runDepth;
      e.cleanup = e.fn() as (() => void) | undefined;
    } finally {
      --runDepth;
      activeSub = prevSub;
      e.flags &= ~RF.RecursedCheck;
    }

    const dispose = (): void => {
      e.flags = RF.None;
      if (e.cleanup) {
        try {
          e.cleanup();
        } catch (err) {
          console.warn("[reactive-scope] effect cleanup error:", err);
        }
        e.cleanup = undefined;
      }
      let cur: Link | undefined = e.depsTail;
      while (cur !== undefined) {
        const prev = cur.prevDep;
        unlink(cur, e);
        cur = prev;
      }
    };

    return dispose;
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
