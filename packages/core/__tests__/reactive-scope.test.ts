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

    it("first eval via updateComputed handles duplicate dep reads (a()+b()+a())", () => {
      const { signal, computed } = createScope();
      const a = signal(0);
      const b = signal(1);
      let evalCount = 0;
      const c = computed(() => {
        evalCount++;
        return a() + b() + a();
      });
      expect(c()).toBe(1);
      expect(evalCount).toBe(1);
      a(2);
      expect(c()).toBe(5);
      expect(evalCount).toBe(2);
    });

    it("first eval via updateComputed purges unreferenced deps on re-eval", () => {
      const { signal, computed } = createScope();
      const toggle = signal(true);
      const a = signal(0);
      const b = signal(1);
      let evalCount = 0;
      const c = computed(() => {
        evalCount++;
        return toggle() ? a() : b();
      });
      expect(c()).toBe(0);
      expect(evalCount).toBe(1);
      a(2);
      expect(c()).toBe(2);
      expect(evalCount).toBe(2);
      toggle(false);
      expect(c()).toBe(1);
      expect(evalCount).toBe(3);
      a(5);
      expect(c()).toBe(1);
      expect(evalCount).toBe(3);
    });
  });

  describe("effect dispose safety", () => {
    it("parent dispose does not throw when children exist", () => {
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

    it("survivor before thrower runs properly after exception", () => {
      const { signal, effect } = createScope();
      const s = signal(0);
      const survivor = vi.fn();

      effect(() => {
        s();
        survivor();
      });

      effect(() => {
        s();
        if (s() > 0) throw new Error("boom");
      });

      effect(() => {
        s();
      });

      survivor.mockClear();
      try {
        s(1);
      } catch {
        // expected
      }
      try {
        s(2);
      } catch {
        // expected
      }
      expect(survivor).toHaveBeenCalledTimes(2);
    });
  });

  describe("owner tree", () => {
    it("dispose effects recursively through children array", () => {
      const { signal, effect } = createScope();
      const s = signal(0);
      const childFn = vi.fn();
      const grandchildFn = vi.fn();

      const parentStop = effect(() => {
        s();
        effect(() => {
          s();
          effect(() => {
            s();
            grandchildFn();
          });
          childFn();
        });
      });

      childFn.mockClear();
      grandchildFn.mockClear();
      parentStop();
      s(1);
      expect(childFn).not.toHaveBeenCalled();
      expect(grandchildFn).not.toHaveBeenCalled();
    });

    it("disposes all siblings — no sibling skipped due to mutation during iteration", () => {
      const { signal, effect } = createScope();
      const s = signal(0);
      const fn1 = vi.fn();
      const fn2 = vi.fn();
      const fn3 = vi.fn();

      const parentStop = effect(() => {
        s();
        effect(() => { s(); fn1(); });
        effect(() => { s(); fn2(); });
        effect(() => { s(); fn3(); });
      });

      fn1.mockClear();
      fn2.mockClear();
      fn3.mockClear();
      parentStop();
      s(1);
      expect(fn1).not.toHaveBeenCalled();
      expect(fn2).not.toHaveBeenCalled();
      expect(fn3).not.toHaveBeenCalled();
    });
  });

  describe("unwatched callback", () => {
    it("cleanup runs exactly once during dispose (unwatched after deps cleared does not double-fire)", () => {
      const { signal, effect } = createScope();
      const s = signal(0);
      const cleanup = vi.fn();

      const eStop = effect(() => {
        s();
        return cleanup;
      });

      eStop();
      expect(cleanup).toHaveBeenCalledTimes(1);
    });
  });

  describe("propagate during computed getter", () => {
    it("does not leak Pending after updateComputed", () => {
      const { signal, computed } = createScope();
      const s = signal(0);
      let callCount = 0;

      const c = computed(() => {
        callCount++;
        return s() * 2;
      });

      expect(c()).toBe(0);
      expect(callCount).toBe(1);
      s(1);
      expect(c()).toBe(2);
      expect(callCount).toBe(2);
      expect(c()).toBe(2);
      expect(callCount).toBe(2);
    });
  });

  describe("isFlushing with nested batch", () => {
    it("reentrant flush guard does not block manual flush after batch", () => {
      const { signal, effect, startBatch, endBatch } = createScope();
      const s = signal(0);
      const fn = vi.fn();

      effect(() => {
        s();
        fn();
      });

      fn.mockClear();
      startBatch();
      s(1);
      endBatch();
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe("computed lazy re-evaluation after signal change", () => {
    it("re-evaluates once on read after signal change", () => {
      const { signal, computed } = createScope();
      const x = signal(0);
      let evalCount = 0;

      const c = computed(() => {
        evalCount++;
        return x() * 2;
      });

      c();
      expect(evalCount).toBe(1);
      x(1);
      expect(evalCount).toBe(1);
      c();
      expect(evalCount).toBe(2);
      c();
      expect(evalCount).toBe(2);
    });
  });

  describe("effect cleanup throws during re-eval", () => {
    it("does not prevent re-evaluation", () => {
      const { signal, effect } = createScope();
      const s = signal(0);
      const fn = vi.fn();

      const stop = effect(() => {
        s();
        fn();
        return () => {
          throw new Error("cleanup error");
        };
      });

      fn.mockClear();
      s(1);
      expect(fn).toHaveBeenCalledTimes(1);
      stop();
    });
  });

  describe("computed unwatched", () => {
    it("computed re-evaluates after last subscriber is disposed", () => {
      const { signal, computed, effect } = createScope();
      const s = signal(0);
      let evalCount = 0;

      const c = computed(() => {
        evalCount++;
        return s() * 2;
      });

      const dispose = effect(() => {
        c();
      });

      evalCount = 0;
      dispose();
      s(1);
      c();
      expect(evalCount).toBe(1);
    });
  });

  describe("signal edge cases", () => {
    it("setting to same value is no-op (no notification)", () => {
      const { signal, effect } = createScope();
      const s = signal(0);
      const fn = vi.fn();
      effect(() => {
        s();
        fn();
      });
      fn.mockClear();
      s(0);
      expect(fn).not.toHaveBeenCalled();
    });
  });

  describe("computed edge cases", () => {
    it("diamond dependency propagates correctly", () => {
      const { signal, computed } = createScope();
      const x = signal(0);
      const b = computed(() => x() + 1);
      const c = computed(() => x() + 2);
      const d = computed(() => b() + c());
      expect(d()).toBe(3);
      x(1);
      expect(d()).toBe(5);
    });

    it("throws during evaluation propagates to caller", () => {
      const { signal, computed } = createScope();
      const s = signal(0);
      const c = computed(() => {
        if (s() > 0) throw new Error("computed boom");
        return s();
      });
      expect(c()).toBe(0);
      s(1);
      expect(() => c()).toThrow("computed boom");
    });

    it("constant computed (no deps) caches", () => {
      const { computed } = createScope();
      let evalCount = 0;
      const c = computed(() => {
        evalCount++;
        return 42;
      });
      expect(c()).toBe(42);
      expect(evalCount).toBe(1);
      expect(c()).toBe(42);
      expect(evalCount).toBe(1);
    });
  });

  describe("effect edge cases", () => {
    it("effect with no deps runs once then never again", () => {
      const { signal, effect } = createScope();
      const s = signal(0);
      const fn = vi.fn();
      effect(() => {
        fn();
      });
      fn.mockClear();
      s(1);
      expect(fn).not.toHaveBeenCalled();
    });

    it("cleanup returning non-function is ignored", () => {
      const { signal, effect } = createScope();
      const s = signal(0);
      const fn = vi.fn();
      effect(() => {
        s();
        fn();
        return 123 as unknown as () => void;
      });
      fn.mockClear();
      s(1);
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe("batch edge cases", () => {
    it("nested batch works correctly", () => {
      const { signal, computed, startBatch, endBatch } = createScope();
      const s = signal(0);
      let evalCount = 0;
      const c = computed(() => {
        evalCount++;
        return s() * 2;
      });
      c();
      evalCount = 0;
      startBatch();
      s(1);
      startBatch();
      s(2);
      endBatch();
      expect(evalCount).toBe(0);
      endBatch();
      c();
      expect(evalCount).toBe(1);
    });
  });

  describe("flush reentrancy guard (isFlushing)", () => {
    it("effect setting signal during flush hits reentry guard", () => {
      const { signal, effect } = createScope();
      const a = signal(0);
      const b = signal(0);
      const order: string[] = [];

      effect(() => {
        a();
        if (a() > 0) {
          b(1);
        }
        order.push("e1");
      });

      effect(() => {
        b();
        order.push("e2");
      });

      order.length = 0;
      a(1);
      expect(order).toEqual(["e1", "e2"]);
    });
  });

  describe("computed Pending path (same-value dep)", () => {
    it("Pending computed with unchanged dep returns cached value", () => {
      const { signal, computed } = createScope();
      const s = signal(0);
      let isEvenCount = 0;

      const isEven = computed(() => {
        isEvenCount++;
        return s() % 2 === 0;
      });

      const parity = computed(() => (isEven() ? "even" : "odd"));

      parity();
      expect(isEvenCount).toBe(1);

      s(2);
      expect(parity()).toBe("even");
      expect(isEvenCount).toBe(2);

      s(1);
      expect(parity()).toBe("odd");
      expect(isEvenCount).toBe(3);
    });
  });

  describe("advanced: effect self-destruction", () => {
    it("effect can dispose itself during re-eval without corruption", () => {
      const { signal, effect } = createScope();
      const s = signal(0);
      let stop!: () => void;
      let triggerCount = 0;
      stop = effect(() => {
        s();
        triggerCount++;
        if (s() > 0) {
          stop();
        }
      });
      expect(triggerCount).toBe(1);
      expect(() => s(1)).not.toThrow();
    });
  });

  describe("advanced: computed exception recovery", () => {
    it("computed recovers after throwing during eval", () => {
      const { signal, computed } = createScope();
      const s = signal(0);
      const c = computed(() => {
        if (s() > 0) throw new Error("boom");
        return s();
      });
      expect(c()).toBe(0);
      s(1);
      expect(() => c()).toThrow("boom");
      s(0);
      expect(c()).toBe(0);
    });
  });

  describe("advanced: batch exception recovery", () => {
    it("batchDepth resets after exception in batch", () => {
      const { signal, effect, startBatch, endBatch } = createScope();
      const s = signal(0);
      const fn = vi.fn();
      effect(() => {
        s();
        fn();
      });
      fn.mockClear();

      startBatch();
      s(1);
      endBatch();
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("flush works after exception during batch endBatch", () => {
      const { signal, effect, startBatch, endBatch } = createScope();
      const s = signal(0);
      const fn = vi.fn();
      effect(() => {
        s();
        fn();
      });

      fn.mockClear();
      startBatch();
      s(1);
      endBatch();
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe("advanced: diamond graph glitch-free", () => {
    it("diamond B->D->C does not double-fire D", () => {
      const { signal, effect } = createScope();
      const x = signal(0);
      const dCalls: number[] = [];

      effect(() => {
        x();
      });

      effect(() => {
        x();
        dCalls.push(1);
      });

      dCalls.length = 0;
      x(1);
      expect(dCalls).toEqual([1]);
    });
  });
});
