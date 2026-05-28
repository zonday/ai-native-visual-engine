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
});
