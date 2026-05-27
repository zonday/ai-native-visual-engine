import { describe, expect, it } from "vitest";
import { createScheduler } from "../src/scheduler/scheduler.js";

describe("Scheduler", () => {
  describe("markDirty", () => {
    it("adds nodes to dirty set", () => {
      const s = createScheduler({ mode: "sync" });
      s.markDirty(["a", "b"]);
      expect(s.getDirtyNodes()).toEqual(["a", "b"]);
    });

    it("is idempotent for duplicate node IDs", () => {
      const s = createScheduler({ mode: "sync" });
      s.markDirty(["a", "a", "b"]);
      expect(s.getDirtyNodes()).toHaveLength(2);
    });

    it("triggers compute phase on next microtask", async () => {
      const s = createScheduler({ mode: "sync" });
      let computed = false;
      s.subscribe({
        onBeforeCompute: (nodes) => {
          computed = true;
          expect(nodes).toContain("a");
        },
      });
      s.markDirty(["a"]);
      await s.flush();
      expect(computed).toBe(true);
    });
  });

  describe("subscribe", () => {
    it("fires onBeforeCompute with dirty nodes", async () => {
      const s = createScheduler({ mode: "sync" });
      let seen: string[] = [];
      s.subscribe({
        onBeforeCompute: (nodes) => {
          seen = nodes;
        },
      });
      s.markDirty(["x", "y"]);
      await s.flush();
      expect(seen.sort()).toEqual(["x", "y"]);
    });

    it("fires onBeforeRender and onAfterRender in order", async () => {
      const s = createScheduler({ mode: "sync" });
      const order: string[] = [];
      s.subscribe({
        onBeforeCompute: () => order.push("compute"),
        onBeforeRender: () => order.push("render:before"),
        onAfterRender: () => order.push("render:after"),
      });
      s.markDirty(["a"]);
      await s.flush();
      expect(order).toEqual(["compute", "render:before", "render:after"]);
    });

    it("unsubscribe stops notifications", async () => {
      const s = createScheduler({ mode: "sync" });
      let count = 0;
      const unsub = s.subscribe({
        onAfterCompute: () => {
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

    it("moves through compute → render → idle", async () => {
      const s = createScheduler({ mode: "sync" });
      const phases: string[] = [];
      s.subscribe({
        onBeforeCompute: () => phases.push(s.getPhase()),
        onBeforeRender: () => phases.push(s.getPhase()),
        onAfterRender: () => phases.push(s.getPhase()),
      });
      s.markDirty(["a"]);
      await s.flush();
      expect(phases).toEqual(["compute", "render", "idle"]);
    });
  });

  describe("no-op when no dirty nodes", () => {
    it("completes immediately when flush called with no dirty nodes", async () => {
      const s = createScheduler({ mode: "sync" });
      let called = false;
      s.subscribe({
        onBeforeCompute: () => {
          called = true;
        },
      });
      await s.flush();
      expect(called).toBe(false);
    });
  });
});
