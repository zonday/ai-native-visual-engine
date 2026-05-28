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

const enum RF {
  None = 0,
  Mutable = 1,
  Watching = 2,
  Dirty = 16,
  Pending = 32,
}

export type Signal<T> = {
  (): T;
  (value: T): void;
};

export type Computed<T> = () => T;

export function createScope() {
  const HasChildEffect = 64;
  let cycle = 0;
  let runDepth = 0;
  let batchDepth = 0;
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
        node.flags = RF.Mutable;
        return true;
      },
      notify(effect: ReactiveNode): void {
        let insertIndex = queuedLength;
        let firstInsertedIndex = insertIndex;
        do {
          queued[insertIndex++] = effect;
          effect.flags &= ~RF.Watching;
          effect = effect.subs?.sub as ReactiveNode | undefined;
          if (effect === undefined || !(effect.flags & RF.Watching)) break;
        } while (true);
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
            disposeDeps(node);
          }
        } else if ("currentValue" in node) {
          // signal — nothing to clean up
        }
      },
    });

  function disposeDeps(sub: ReactiveNode): void {
    let link = sub.depsTail;
    while (link !== undefined) {
      const prev = link.prevDep;
      unlink(link, sub);
      link = prev;
    }
  }

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
        const prev = link.prevDep;
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
      return oldValue !== (c.value = c.getter(oldValue));
    } finally {
      activeSub = prevSub;
      c.flags &= ~RF.Watching;
      purgeDeps(c);
    }
  }

  function updateSignal(s: SignalInternal): boolean {
    s.flags = RF.Mutable;
    return s.currentValue !== (s.currentValue = s.pendingValue);
  }

  function run(e: ReactiveNode): void {
    const flags = e.flags;
    if (
      flags & RF.Dirty ||
      (flags & RF.Pending && checkDirty(e.deps!, e))
    ) {
      if (flags & HasChildEffect) {
        let link = e.depsTail;
        while (link !== undefined) {
          const prev = link.prevDep;
          const dep = link.dep;
          if (!("getter" in dep) && !("currentValue" in dep)) {
            unlink(link, e);
          }
          link = prev;
        }
      }
      e.depsTail = undefined;
      e.flags = RF.Watching | RF.Watching;
      const prevSub = activeSub;
      activeSub = e;
      try {
        ++cycle;
        ++runDepth;
        const fn = (e as EffectInternal).fn;
        fn();
      } finally {
        --runDepth;
        activeSub = prevSub;
        e.flags &= ~RF.Watching;
        purgeDeps(e);
      }
    } else if (e.deps !== undefined) {
      e.flags = RF.Watching | (flags & HasChildEffect);
    }
  }

  function flush(): void {
    try {
      while (notifyIndex < queuedLength) {
        const effect = queued[notifyIndex]!;
        queued[notifyIndex++] = undefined;
        run(effect);
      }
    } finally {
      while (notifyIndex < queuedLength) {
        const effect = queued[notifyIndex]!;
        queued[notifyIndex++] = undefined;
        effect.flags |= RF.Watching | RF.Watching;
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
    fn: () => void;
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

    const oper = function (this: void, value?: T): T | void {
      if (arguments.length) {
        if (node.pendingValue !== (node.pendingValue = value)) {
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
      if (
        flags & RF.Dirty ||
        (flags & RF.Pending &&
          (checkDirty(node.deps!, node) ||
            ((node.flags = flags & ~RF.Pending), false)))
      ) {
        if (updateComputed(node)) {
          const subs = node.subs;
          if (subs !== undefined) shallowPropagate(subs);
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

  return { signal, computed, flush };
}
