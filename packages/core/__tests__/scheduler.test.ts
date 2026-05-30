import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createScheduler } from "../src/scheduler.js";

describe("Scheduler", () => {
  describe("markDirty", () => {
    it("adds nodes to dirty set", () => {
      const s = createScheduler({ mode: "microtask" });
      s.markDirty(["a", "b"]);
      expect(s.getDirtyNodes()).toEqual(["a", "b"]);
    });

    it("is idempotent for duplicate node IDs", () => {
      const s = createScheduler({ mode: "microtask" });
      s.markDirty(["a", "a", "b"]);
      expect(s.getDirtyNodes()).toHaveLength(2);
    });

    it("triggers compute phase on next microtask", async () => {
      const s = createScheduler({ mode: "microtask" });
      let computed = false;
      s.subscribe({
        onCompute: (nodes) => {
          computed = true;
          expect(nodes).toContain("a");
        },
      });
      s.markDirty(["a"]);
      await s.flush();
      expect(computed).toBe(true);
    });

    it("reentrant markDirty is processed in next cycle", async () => {
      const s = createScheduler({ mode: "microtask" });
      const computeLog: string[][] = [];
      s.subscribe({
        onCompute: (nodes) => {
          computeLog.push(nodes);
          if (nodes.includes("a")) {
            s.markDirty(["b"]);
          }
        },
      });
      s.markDirty(["a"]);
      await s.flush();
      expect(computeLog.length).toBe(2);
      expect(computeLog[0]).toEqual(["a"]);
      expect(computeLog[1]).toEqual(["b"]);
    });
  });

  describe("markAllDirty", () => {
    it("marks all nodes as dirty", async () => {
      const s = createScheduler({ mode: "microtask" });
      let computeCalled = false;
      let computeNodes: string[] | undefined;
      s.subscribe({
        onCompute: (nodes) => {
          computeCalled = true;
          computeNodes = nodes;
        },
      });
      s.markAllDirty();
      await s.flush();
      expect(computeCalled).toBe(true);
      expect(computeNodes).toEqual([]);
    });

    it("triggers render even when no specific nodes are dirty", async () => {
      const s = createScheduler({ mode: "microtask" });
      let rendered = false;
      s.subscribe({
        onRender: () => {
          rendered = true;
        },
      });
      s.markAllDirty();
      await s.flush();
      expect(rendered).toBe(true);
    });
  });

  describe("subscribe", () => {
    it("fires onCompute with dirty nodes", async () => {
      const s = createScheduler({ mode: "microtask" });
      let seen: string[] = [];
      s.subscribe({
        onCompute: (nodes) => {
          seen = nodes;
        },
      });
      s.markDirty(["x", "y"]);
      await s.flush();
      expect(seen.sort()).toEqual(["x", "y"]);
    });

    it("fires onCompute and onRender in order", async () => {
      const s = createScheduler({ mode: "microtask" });
      const order: string[] = [];
      s.subscribe({
        onCompute: () => order.push("compute"),
        onRender: () => order.push("render"),
      });
      s.markDirty(["a"]);
      await s.flush();
      expect(order).toEqual(["compute", "render"]);
    });

    it("unsubscribe stops notifications", async () => {
      const s = createScheduler({ mode: "microtask" });
      let count = 0;
      const unsub = s.subscribe({
        onCompute: () => {
          count++;
        },
      });
      s.markDirty(["a"]);
      await s.flush();
      expect(count).toBe(1);

      unsub();
      s.markDirty(["b"]);
      await s.flush();
      expect(count).toBe(1);
    });
  });

  describe("phase tracking", () => {
    it("starts in idle phase", () => {
      const s = createScheduler();
      expect(s.getPhase()).toBe("idle");
    });

    it("moves through compute -> render -> idle", async () => {
      const s = createScheduler({ mode: "microtask" });
      const phases: string[] = [];
      s.subscribe({
        onCompute: () => phases.push(s.getPhase()),
        onRender: () => phases.push(s.getPhase()),
      });
      s.markDirty(["a"]);
      await s.flush();
      expect(phases).toEqual(["compute", "render"]);
    });

    it("returns to idle after flush", async () => {
      const s = createScheduler({ mode: "microtask" });
      s.markDirty(["a"]);
      await s.flush();
      expect(s.getPhase()).toBe("idle");
    });
  });

  describe("no-op when no dirty nodes", () => {
    it("completes immediately when flush called with no dirty nodes", async () => {
      const s = createScheduler({ mode: "microtask" });
      let called = false;
      s.subscribe({
        onCompute: () => {
          called = true;
        },
      });
      await s.flush();
      expect(called).toBe(false);
    });
  });

  describe("reentrant markDirty", () => {
    it("does not throw when markDirty is called during compute", async () => {
      const s = createScheduler({ mode: "microtask" });
      s.subscribe({
        onCompute: (nodes) => {
          if (nodes.includes("a")) {
            s.markDirty(["b"]);
          }
        },
      });
      s.markDirty(["a"]);
      await expect(s.flush()).resolves.toBeUndefined();
    });
  });

  describe("starvation protection", () => {
    it("throws when immediate mode exceeds max flush depth", () => {
      const s = createScheduler({ mode: "immediate" });
      s.subscribe({
        onCompute: () => {
          s.markDirty(["x"]);
        },
      });
      expect(() => s.markDirty(["x"])).toThrow(
        "Maximum scheduler flush depth exceeded",
      );
    });
  });

  describe("flush promise", () => {
    it("resolves multiple concurrent flush calls", async () => {
      const s = createScheduler({ mode: "microtask" });
      s.markDirty(["a"]);

      const p1 = s.flush();
      const p2 = s.flush();
      const p3 = s.flush();

      await expect(Promise.all([p1, p2, p3])).resolves.toEqual([
        undefined,
        undefined,
        undefined,
      ]);
    });

    it("resolves immediately when nothing is dirty", async () => {
      const s = createScheduler({ mode: "microtask" });
      await expect(s.flush()).resolves.toBeUndefined();
    });
  });

  describe("immediate mode", () => {
    it("runs synchronously", () => {
      const s = createScheduler({ mode: "immediate" });
      let computed = false;
      let rendered = false;
      s.subscribe({
        onCompute: () => {
          computed = true;
        },
        onRender: () => {
          rendered = true;
        },
      });
      s.markDirty(["a"]);
      expect(computed).toBe(true);
      expect(rendered).toBe(true);
    });

    it("getDirtyNodes returns empty after sync flush", () => {
      const s = createScheduler({ mode: "immediate" });
      s.markDirty(["a"]);
      expect(s.getDirtyNodes()).toEqual([]);
    });
  });

  describe("raf mode", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) =>
        setTimeout(cb, 16),
      );
    });

    afterEach(() => {
      vi.unstubAllGlobals();
      vi.useRealTimers();
    });

    it("schedules via rAF and executes compute/render cycle", () => {
      const s = createScheduler({ mode: "raf" });
      let computed = false;
      s.subscribe({
        onCompute: () => {
          computed = true;
        },
      });
      s.markDirty(["a"]);
      expect(computed).toBe(false);
      vi.advanceTimersByTime(16);
      expect(computed).toBe(true);
    });

    it("batches multiple markDirty calls within same frame", () => {
      const s = createScheduler({ mode: "raf" });
      const seen: string[] = [];
      s.subscribe({
        onCompute: (nodes) => {
          seen.push(...nodes);
        },
      });
      s.markDirty(["a"]);
      s.markDirty(["b"]);
      expect(seen).toEqual([]);
      vi.advanceTimersByTime(16);
      expect(seen.sort()).toEqual(["a", "b"]);
    });

    it("returns to idle after rAF flush", () => {
      const s = createScheduler({ mode: "raf" });
      s.markDirty(["a"]);
      vi.advanceTimersByTime(16);
      expect(s.getPhase()).toBe("idle");
    });
  });

  describe("mode switching", () => {
    it("setMode changes scheduling behavior", async () => {
      const s = createScheduler({ mode: "microtask" });
      s.setMode("immediate");
      let rendered = false;
      s.subscribe({
        onRender: () => {
          rendered = true;
        },
      });
      s.markDirty(["a"]);
      expect(rendered).toBe(true);
    });
  });

  describe("error resilience", () => {
    it("is reusable after a listener throws during compute", async () => {
      const s = createScheduler({ mode: "microtask" });
      s.subscribe({
        onCompute: () => {
          throw new Error("listener crash");
        },
      });
      s.markDirty(["a"]);
      await s.flush();
      expect(s.getPhase()).toBe("idle");
      expect(s.getDirtyNodes()).toEqual([]);
    });

    it("processes remaining listeners after a listener throws", async () => {
      const s = createScheduler({ mode: "microtask" });
      const results: string[] = [];
      s.subscribe({
        onCompute: () => {
          throw new Error("crash");
        },
      });
      s.subscribe({
        onCompute: (nodes) => {
          results.push(...nodes);
        },
      });
      s.markDirty(["a"]);
      await s.flush();
      expect(results).toContain("a");
    });

    it("is reusable after depth-limit abort", () => {
      const s = createScheduler({ mode: "immediate" });
      s.subscribe({
        onCompute: () => {
          s.markDirty(["x"]);
        },
      });
      expect(() => s.markDirty(["x"])).toThrow(
        "Maximum scheduler flush depth exceeded",
      );
      expect(s.getPhase()).toBe("idle");
      expect(s.getDirtyNodes()).toEqual([]);
    });

    it("processes new work after depth-limit abort", () => {
      const s = createScheduler({ mode: "immediate" });
      let count = 0;
      const reentrant = () => {
        s.markDirty(["x"]);
      };
      const unsub = s.subscribe({ onCompute: reentrant });
      expect(() => s.markDirty(["x"])).toThrow(
        "Maximum scheduler flush depth exceeded",
      );
      expect(s.getPhase()).toBe("idle");
      unsub();
      s.subscribe({
        onCompute: () => {
          count++;
        },
      });
      s.markDirty(["y"]);
      expect(count).toBe(1);
      expect(s.getPhase()).toBe("idle");
    });
  });

  describe("listener snapshot isolation", () => {
    it("does not invoke listener added during current cycle", async () => {
      const s = createScheduler({ mode: "microtask" });
      const addedDuring: string[] = [];
      s.subscribe({
        onCompute: () => {
          s.subscribe({
            onCompute: (nodes) => addedDuring.push(...nodes),
          });
        },
      });
      s.markDirty(["a"]);
      await s.flush();
      expect(addedDuring).toEqual([]);
    });

    it("still invokes listener that unsubscribes itself during current cycle", async () => {
      const s = createScheduler({ mode: "microtask" });
      let callCount = 0;
      const unsub = s.subscribe({
        onCompute: () => {
          callCount++;
          unsub();
        },
      });
      s.markDirty(["a"]);
      await s.flush();
      expect(callCount).toBe(1);
    });
  });

  describe("markAllDirty during cycle", () => {
    it("defers allDirty to next cycle", async () => {
      const s = createScheduler({ mode: "microtask" });
      const computeArgs: (string[] | undefined)[] = [];
      s.subscribe({
        onCompute: (nodes) => {
          computeArgs.push(nodes);
          if (nodes.includes("a")) {
            s.markAllDirty();
          }
        },
      });
      s.markDirty(["a"]);
      await s.flush();
      expect(computeArgs.length).toBe(2);
      expect(computeArgs[0]).toEqual(["a"]);
      expect(computeArgs[1]).toEqual([]);
    });
  });

  describe("raf mode with flush", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) =>
        setTimeout(cb, 16),
      );
    });

    afterEach(() => {
      vi.unstubAllGlobals();
      vi.useRealTimers();
    });

    it("flush() resolves after rAF cycle completes", () => {
      const s = createScheduler({ mode: "raf" });
      let computed = false;
      s.subscribe({
        onCompute: () => {
          computed = true;
        },
      });
      s.markDirty(["a"]);
      const flushPromise = s.flush();
      vi.advanceTimersByTime(16);
      return expect(flushPromise)
        .resolves.toBeUndefined()
        .then(() => {
          expect(computed).toBe(true);
        });
    });
  });

  describe("coverage edge cases", () => {
    it("markDirty with empty array is a no-op", async () => {
      const s = createScheduler({ mode: "microtask" });
      let called = false;
      s.subscribe({
        onCompute: () => {
          called = true;
        },
      });
      s.markDirty([]);
      await s.flush();
      expect(called).toBe(false);
    });

    it("markAllDirty discards previously marked specific nodes", async () => {
      const s = createScheduler({ mode: "microtask" });
      const seen: string[] = [];
      s.subscribe({ onCompute: (nodes) => seen.push(...nodes) });
      s.markDirty(["a"]);
      s.markAllDirty();
      await s.flush();
      // markAllDirty clears currentDirty, so listener gets [] not ["a"]
      expect(seen).toEqual([]);
    });

    it("getDirtyNodes shows reentrant marks during a cycle", () => {
      const s = createScheduler({ mode: "immediate" });
      let dirtyDuring: string[] = [];
      s.subscribe({
        onCompute: (nodes) => {
          if (nodes.includes("a")) {
            s.markDirty(["b"]);
            dirtyDuring = s.getDirtyNodes();
          }
        },
      });
      s.markDirty(["a"]);
      // "a" was captured before compute; currentDirty was reset.
      // "b" is written to the fresh currentDirty for the next cycle.
      expect(dirtyDuring).toEqual(["b"]);
    });
  });
});
