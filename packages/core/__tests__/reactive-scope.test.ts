import { describe, expect, it, vi } from "vitest";
import { createScope } from "../src/deps/reactive-scope";

describe("createScope", () => {
  it("signal get/set works", () => {
    const { signal } = createScope();
    const s = signal(0);
    expect(s()).toBe(0);
    s(1);
    expect(s()).toBe(1);
  });

  it("computed tracks signal dependency", () => {
    const { signal, computed } = createScope();
    const s = signal(0);
    let evalCount = 0;
    const c = computed(() => {
      evalCount++;
      return s() * 2;
    });
    expect(c()).toBe(0);
    expect(evalCount).toBe(1);
    expect(c()).toBe(0);
    expect(evalCount).toBe(1);
  });

  it("computed re-evaluates when signal changes", () => {
    const { signal, computed } = createScope();
    const s = signal(0);
    let evalCount = 0;
    const c = computed(() => {
      evalCount++;
      return s() * 2;
    });
    c();
    s(1);
    expect(c()).toBe(2);
    expect(evalCount).toBe(2);
  });

  it("multiple signals within one computed", () => {
    const { signal, computed } = createScope();
    const s1 = signal(0);
    const s2 = signal(0);
    const c = computed(() => s1() + s2());
    expect(c()).toBe(0);
    s1(5);
    expect(c()).toBe(5);
    s2(3);
    expect(c()).toBe(8);
  });

  it("isolated scopes do not interfere", () => {
    const { signal: sig1, computed: comp1 } = createScope();
    const { signal: sig2, computed: comp2 } = createScope();
    const s1 = sig1(0);
    const s2 = sig2(0);
    const c1 = comp1(() => s1());
    const c2 = comp2(() => s2());
    expect(c1()).toBe(0);
    expect(c2()).toBe(0);
    s1(42);
    expect(c1()).toBe(42);
    expect(c2()).toBe(0);
  });

  describe("effect", () => {
    it("runs immediately with initial values", () => {
      const { signal, effect } = createScope();
      const s = signal(0);
      const fn = vi.fn();
      effect(() => {
        s();
        fn();
      });
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("re-runs when dependencies change", () => {
      const { signal, effect } = createScope();
      const s = signal(0);
      const fn = vi.fn();
      effect(() => {
        s();
        fn();
      });
      fn.mockClear();
      s(1);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("stops after dispose", () => {
      const { signal, effect } = createScope();
      const s = signal(0);
      const fn = vi.fn();
      const dispose = effect(() => {
        s();
        fn();
      });
      fn.mockClear();
      dispose();
      s(1);
      expect(fn).not.toHaveBeenCalled();
    });

    it("supports cleanup function", () => {
      const { signal, effect } = createScope();
      const s = signal(0);
      const cleanup = vi.fn();
      effect(() => {
        s();
        return cleanup;
      });
      s(1);
      expect(cleanup).toHaveBeenCalledTimes(1);
    });
  });

  describe("batching", () => {
    it("startBatch/endBatch defers recomputation", () => {
      const { signal, computed, startBatch, endBatch } = createScope();
      const s = signal(0);
      let evalCount = 0;
      const c = computed(() => {
        evalCount++;
        return s() * 2;
      });
      c();
      expect(evalCount).toBe(1);
      startBatch();
      s(1);
      s(2);
      s(3);
      expect(evalCount).toBe(1); // not re-evaluated yet
      endBatch();
      expect(c()).toBe(6);
      expect(evalCount).toBe(2); // re-evaluated once
    });
  });

  describe("disposed effect does not run", () => {
    it("skips disposed effect in batch queue", () => {
      const { signal, effect, startBatch, endBatch } = createScope();
      const s = signal(0);
      const fn = vi.fn();
      const stop = effect(() => {
        s();
        fn();
      });
      fn.mockClear();
      startBatch();
      s(1);
      stop();
      endBatch();
      expect(fn).not.toHaveBeenCalled();
    });

    it("disposed effect does not run after manual flush", () => {
      const { signal, effect, flush } = createScope();
      const s = signal(0);
      const fn = vi.fn();
      const stop = effect(() => {
        s();
        fn();
      });
      fn.mockClear();
      stop();
      s(1);
      flush();
      expect(fn).not.toHaveBeenCalled();
    });
  });

  describe("computed cycle detection", () => {
    it("throws on direct cycle A -> B -> A via updateComputed", () => {
      const { computed } = createScope();
      const a: ReturnType<typeof computed> = computed(() => b());
      const b: ReturnType<typeof computed> = computed(() => a());
      expect(() => a()).toThrow("Cycle detected");
    });

    it("throws on self-referencing computed", () => {
      const { computed } = createScope();
      const a: ReturnType<typeof computed> = computed(() => a());
      expect(() => a()).toThrow("Cycle detected");
    });
  });

  describe("flush reentrancy", () => {
    it("reentrant flush does not cause infinite recursion", () => {
      const { signal, effect } = createScope();
      const s = signal(0);
      let calls = 0;
      effect(() => {
        s();
        calls++;
      });
      s(1);
      s(2);
      expect(calls).toBe(3);
    });
  });

  describe("disposed computed", () => {
    it("throws when read after dispose", () => {
      const { signal, computed } = createScope();
      const s = signal(0);
      const c = computed(() => s() * 2);
      c();
      c.dispose();
      expect(() => c()).toThrow("Cannot read disposed computed");
    });

    it("clears subs links after dispose", () => {
      const { signal, computed } = createScope();
      const s = signal(0);
      const c = computed(() => s() * 2);
      const sub = computed(() => c());
      sub();
      c.dispose();
      s(1);
      expect(() => sub()).not.toThrow();
    });

    it("disposed computed does not resurrect via !flags branch", () => {
      const { computed } = createScope();
      const c = computed(() => 42);
      c();
      c.dispose();
      expect(() => c()).toThrow("Cannot read disposed computed");
    });
  });

  describe("graph consistency", () => {
    it("disposed computed clears all links", () => {
      const { signal, computed } = createScope();
      const s = signal(0);
      const c = computed(() => s() * 2);
      c();
      c.dispose();
      expect(() => c()).toThrow("Cannot read disposed computed");
    });
  });

  describe("hasChildEffect flag cleanup", () => {
    it("child effect dispose does not throw when parent has other deps", () => {
      const { signal, effect } = createScope();
      const s = signal(0);
      const parentStop = effect(() => {
        s();
        effect(() => {
          s();
        });
      });
      expect(() => parentStop()).not.toThrow();
    });
  });

  describe("cleanup runs after deps cleared", () => {
    it("cleanup signal set does not re-queue current effect", () => {
      const { signal, effect } = createScope();
      const s = signal(0);
      const fn = vi.fn();
      const stop = effect(() => {
        s();
        fn();
        return () => {
          s(999);
        };
      });
      fn.mockClear();
      s(1);
      expect(fn).toHaveBeenCalledTimes(1);
      stop();
    });
  });

  describe("nested effect cleanup", () => {
    it("parent dispose does not throw even with child effects", () => {
      const { signal, effect } = createScope();
      const s = signal(0);
      const parentStop = effect(() => {
        s();
        effect(() => {
          s();
        });
      });
      expect(() => parentStop()).not.toThrow();
    });

    it("disposing same effect twice is safe", () => {
      const { signal, effect } = createScope();
      const s = signal(0);
      const stop = effect(() => {
        s();
      });
      stop();
      expect(() => stop()).not.toThrow();
    });
  });

  describe("flush exception path", () => {
    it("exception during flush does not resurrect disposed effect", () => {
      const { signal, effect } = createScope();
      const s = signal(0);
      const fn = vi.fn();
      const stop = effect(() => {
        s();
        fn();
      });
      fn.mockClear();

      effect(() => {
        s();
        if (fn.mock.calls.length > 0) {
          throw new Error("boom");
        }
      });

      stop();
      try {
        s(1);
      } catch {
        // expected
      }
      expect(fn).not.toHaveBeenCalled();
    });
  });

  describe("multi-child hasChildEffect", () => {
    it("disposing one child does not affect sibling child", () => {
      const { signal, effect } = createScope();
      const s = signal(0);
      const child1Fn = vi.fn();
      const child2Fn = vi.fn();
      let child1Stop: (() => void) | undefined;
      let child2Stop: (() => void) | undefined;

      effect(() => {
        s();
        child1Stop = effect(() => {
          s();
          child1Fn();
        });
        child2Stop = effect(() => {
          s();
          child2Fn();
        });
      });

      child1Fn.mockClear();
      child2Fn.mockClear();
      child1Stop?.();
      child2Stop?.();
      s(1);
      expect(child1Fn).not.toHaveBeenCalled();
      expect(child2Fn).not.toHaveBeenCalled();
    });
  });
});
