import type { NodeId } from "../types.js";

export type SchedulePhase = "compute" | "render" | "idle";

export interface ScheduleListener {
  onBeforeCompute?: (dirtyNodes: NodeId[]) => void;
  onAfterCompute?: (dirtyNodes: NodeId[]) => void;
  onBeforeRender?: () => void;
  onAfterRender?: () => void;
}

export interface Scheduler {
  markDirty(nodeIds: NodeId[]): void;
  markAllDirty(): void;
  flush(): Promise<void>;
  subscribe(listener: ScheduleListener): () => void;
  getPhase(): SchedulePhase;
  getDirtyNodes(): NodeId[];
  setMode(mode: "sync" | "async"): void;
}

export function createScheduler(options?: {
  mode?: "sync" | "async";
}): Scheduler {
  let mode: "sync" | "async" = options?.mode ?? "sync";
  let phase: SchedulePhase = "idle";
  const dirtySet = new Set<NodeId>();
  const listeners: ScheduleListener[] = [];
  let scheduled = false;
  let flushResolve: (() => void) | null = null;

  function notifyBeforeCompute(): NodeId[] {
    const nodes = Array.from(dirtySet);
    if (nodes.length === 0) return nodes;
    for (const listener of listeners) {
      listener.onBeforeCompute?.(nodes);
    }
    return nodes;
  }

  function notifyAfterCompute(nodes: NodeId[]): void {
    if (nodes.length === 0) return;
    for (const listener of listeners) {
      listener.onAfterCompute?.(nodes);
    }
  }

  function notifyBeforeRender(): void {
    for (const listener of listeners) {
      listener.onBeforeRender?.();
    }
  }

  function notifyAfterRender(): void {
    for (const listener of listeners) {
      listener.onAfterRender?.();
    }
  }

  function runCycle(): void {
    if (dirtySet.size === 0) {
      phase = "idle";
      return;
    }

    phase = "compute";
    const nodes = notifyBeforeCompute();
    // Compute phase: subscribers invalidate their caches here
    notifyAfterCompute(nodes);

    phase = "render";
    notifyBeforeRender();
    // Render phase: subscribers produce output here
    dirtySet.clear();
    phase = "idle";
    notifyAfterRender();
  }

  function scheduleMicrotask(): void {
    if (scheduled) return;
    scheduled = true;

    if (mode === "sync") {
      Promise.resolve().then(() => {
        scheduled = false;
        runCycle();
        if (flushResolve) {
          flushResolve();
          flushResolve = null;
        }
      });
    } else {
      requestAnimationFrame(() => {
        scheduled = false;
        runCycle();
        if (flushResolve) {
          flushResolve();
          flushResolve = null;
        }
      });
    }
  }

  const scheduler: Scheduler = {
    markDirty(nodeIds: NodeId[]): void {
      for (const id of nodeIds) {
        dirtySet.add(id);
      }
      scheduleMicrotask();
    },

    markAllDirty(): void {
      // markAllDirty is called when we want a full recompute
      // but don't have specific node IDs. The actual node population
      // happens during compute phase.
      scheduleMicrotask();
    },

    flush(): Promise<void> {
      if (dirtySet.size === 0) return Promise.resolve();
      return new Promise((resolve) => {
        flushResolve = resolve;
      });
    },

    subscribe(listener: ScheduleListener): () => void {
      listeners.push(listener);
      return () => {
        const index = listeners.indexOf(listener);
        if (index >= 0) listeners.splice(index, 1);
      };
    },

    getPhase(): SchedulePhase {
      return phase;
    },

    getDirtyNodes(): NodeId[] {
      return Array.from(dirtySet);
    },

    setMode(newMode: "sync" | "async"): void {
      mode = newMode;
    },
  };

  return scheduler;
}
