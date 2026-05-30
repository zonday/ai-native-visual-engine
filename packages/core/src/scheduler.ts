import type { NodeId } from "../types.js";

export type SchedulePhase = "idle" | "compute" | "render";

export interface ScheduleListener {
  onCompute?: (dirtyNodes: NodeId[]) => void;
  onRender?: () => void;
}

export type ScheduleMode = "microtask" | "raf" | "immediate";

export interface Scheduler {
  markDirty(nodeIds: NodeId[]): void;
  markAllDirty(): void;
  flush(): Promise<void>;
  subscribe(listener: ScheduleListener): () => void;
  getPhase(): SchedulePhase;
  getDirtyNodes(): NodeId[];
  setMode(mode: ScheduleMode): void;
}

const MAX_FLUSH_DEPTH = 100;

export function createScheduler(options?: { mode?: ScheduleMode }): Scheduler {
  let mode: ScheduleMode = options?.mode ?? "microtask";
  let phase: SchedulePhase = "idle";
  let flushDepth = 0;
  const currentDirty = new Set<NodeId>();
  const pendingDirty = new Set<NodeId>();
  let allDirty = false;
  let pendingAllDirty = false;
  const listeners: ScheduleListener[] = [];
  let scheduled = false;
  const flushHandlers: {
    resolve: () => void;
    reject: (e: unknown) => void;
  }[] = [];

  function rejectAllFlushPromises(error: Error): void {
    if (flushHandlers.length > 0) {
      const handlers = flushHandlers.splice(0);
      for (const h of handlers) {
        h.reject(error);
      }
    }
  }

  function drainPending(): void {
    if (pendingAllDirty) {
      allDirty = true;
      pendingAllDirty = false;
      currentDirty.clear();
    }
    if (pendingDirty.size > 0) {
      for (const id of pendingDirty) {
        currentDirty.add(id);
      }
      pendingDirty.clear();
    }
  }

  function notifyCompute(): void {
    const snapshot = [...listeners];
    if (allDirty) {
      for (const listener of snapshot) {
        try {
          listener.onCompute?.([]);
        } catch {
          // Isolate listener failures so one crash does not
          // corrupt the scheduler or silence other listeners
        }
      }
    } else if (currentDirty.size > 0) {
      const nodes = Array.from(currentDirty);
      for (const listener of snapshot) {
        try {
          listener.onCompute?.(nodes);
        } catch {
          // Isolate listener failures
        }
      }
    }
  }

  function notifyRender(): void {
    const snapshot = [...listeners];
    for (const listener of snapshot) {
      try {
        listener.onRender?.();
      } catch {
        // Isolate listener failures
      }
    }
  }

  function resolveAllFlushPromises(): void {
    if (flushHandlers.length > 0) {
      const handlers = flushHandlers.splice(0);
      for (const h of handlers) {
        h.resolve();
      }
    }
  }

  function scheduleNext(): void {
    if (pendingDirty.size > 0 || pendingAllDirty) {
      scheduleMicrotask();
    }
  }

  function runCycle(): void {
    drainPending();

    if (currentDirty.size === 0 && !allDirty) {
      phase = "idle";
      flushDepth = 0;
      resolveAllFlushPromises();
      return;
    }

    let aborted = false;

    try {
      flushDepth++;

      if (flushDepth > MAX_FLUSH_DEPTH) {
        flushDepth = 0;
        aborted = true;
        throw new Error(
          "Maximum scheduler flush depth exceeded: possible infinite update loop",
        );
      }

      phase = "compute";
      notifyCompute();

      phase = "render";
      currentDirty.clear();
      allDirty = false;
      notifyRender();
    } finally {
      phase = "idle";
      currentDirty.clear();
      allDirty = false;
      scheduled = false;
      if (aborted) {
        pendingDirty.clear();
        pendingAllDirty = false;
        rejectAllFlushPromises(
          new Error(
            "Maximum scheduler flush depth exceeded: possible infinite update loop",
          ),
        );
      } else {
        resolveAllFlushPromises();
        scheduleNext();
      }
      flushDepth = 0;
    }
  }

  function scheduleMicrotask(): void {
    if (mode === "immediate") {
      runCycle();
      return;
    }
    if (scheduled) return;
    scheduled = true;

    if (mode === "microtask") {
      Promise.resolve().then(() => {
        scheduled = false;
        runCycle();
      });
    } else {
      requestAnimationFrame(() => {
        scheduled = false;
        runCycle();
      });
    }
  }

  const scheduler: Scheduler = {
    markDirty(nodeIds: NodeId[]): void {
      const target = phase !== "idle" ? pendingDirty : currentDirty;
      for (const id of nodeIds) {
        target.add(id);
      }
      if (phase === "idle") {
        scheduleMicrotask();
      }
    },

    markAllDirty(): void {
      if (phase !== "idle") {
        pendingAllDirty = true;
      } else {
        allDirty = true;
        currentDirty.clear();
      }
      if (phase === "idle") {
        scheduleMicrotask();
      }
    },

    async flush(): Promise<void> {
      let depth = 0;
      while (depth < MAX_FLUSH_DEPTH) {
        const empty =
          currentDirty.size === 0 &&
          !allDirty &&
          pendingDirty.size === 0 &&
          !pendingAllDirty;
        if (empty && phase === "idle") return;
        depth++;
        await new Promise((resolve, reject) => {
          flushHandlers.push({ resolve, reject });
        });
      }
      throw new Error(
        "Maximum scheduler flush depth exceeded: possible infinite update loop",
      );
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
      const union = new Set(currentDirty);
      for (const id of pendingDirty) {
        union.add(id);
      }
      return Array.from(union);
    },

    setMode(newMode: ScheduleMode): void {
      mode = newMode;
    },
  };

  return scheduler;
}
