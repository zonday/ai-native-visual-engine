import type { NodeId } from "../types.js";

export type SchedulePhase = "idle" | "compute" | "render";

export interface ScheduleListener {
  onCompute?: (dirtyNodes: NodeId[], all?: boolean) => void;
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
  let allDirty = false;
  const listeners: ScheduleListener[] = [];
  let scheduled = false;
  let epoch = 0;

  const flushRequests: {
    resolve: () => void;
    reject: (e: unknown) => void;
    epoch: number;
  }[] = [];

  function rejectAllFlushPromises(error: Error): void {
    if (flushRequests.length > 0) {
      const requests = flushRequests.splice(0);
      for (const req of requests) {
        req.reject(error);
      }
    }
  }

  function resolveFlushRequests(upToEpoch: number): void {
    if (flushRequests.length > 0) {
      const pending = flushRequests.splice(0);
      for (const req of pending) {
        if (req.epoch <= upToEpoch) {
          req.resolve();
        } else {
          flushRequests.push(req);
        }
      }
    }
  }

  function notifyCompute(dirtyNodes: NodeId[], all: boolean): void {
    const snapshot = [...listeners];
    for (const listener of snapshot) {
      try {
        listener.onCompute?.(dirtyNodes, all);
      } catch {
        // Isolate listener failures so one crash does not
        // corrupt the scheduler or silence other listeners
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

  function runCycle(): void {
    // Capture the batch queued before this cycle started,
    // then reset for reentrant marks and the next cycle.
    const batch = new Set(currentDirty);
    const batchAll = allDirty;
    currentDirty.clear();
    allDirty = false;

    if (batch.size === 0 && !batchAll) {
      resolveFlushRequests(epoch);
      return;
    }

    epoch++;
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
      if (batchAll) {
        notifyCompute([], true);
      } else {
        notifyCompute(Array.from(batch), false);
      }

      phase = "render";
      notifyRender();
    } finally {
      phase = "idle";
      scheduled = false;
      if (aborted) {
        currentDirty.clear();
        allDirty = false;
        rejectAllFlushPromises(
          new Error(
            "Maximum scheduler flush depth exceeded: possible infinite update loop",
          ),
        );
      } else {
        resolveFlushRequests(epoch);
        if (currentDirty.size > 0 || allDirty) {
          scheduleMicrotask();
        }
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
      for (const id of nodeIds) {
        currentDirty.add(id);
      }
      if (phase === "idle") {
        scheduleMicrotask();
      }
    },

    markAllDirty(): void {
      allDirty = true;
      currentDirty.clear();
      if (phase === "idle") {
        scheduleMicrotask();
      }
    },

    async flush(): Promise<void> {
      let depth = 0;
      while (depth < MAX_FLUSH_DEPTH) {
        const empty = currentDirty.size === 0 && !allDirty;
        // scheduled tracks whether a microtask/raf callback is pending.
        // Without it, flush would resolve before a re-entrantly scheduled
        // cycle had a chance to run — making it a weak epoch barrier instead
        // of a strict quiescence barrier.
        const pending = mode !== "immediate" && scheduled;
        if (empty && phase === "idle" && !pending) return;
        depth++;
        const reqEpoch = epoch;
        await new Promise((resolve, reject) => {
          flushRequests.push({ resolve, reject, epoch: reqEpoch });
        });
      }
      // After the loop exits, the consumer's listener may still be re-marking
      // the same nodes, driving the microtask chain independently. That chain
      // is the consumer's responsibility, not a scheduler leak.
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
      return Array.from(currentDirty);
    },

    setMode(newMode: ScheduleMode): void {
      mode = newMode;
    },
  };

  return scheduler;
}
