import { describe, expect, it, vi } from "vitest";
import { CommandRegistry } from "../src/commands/command-registry.js";
import type { Command } from "../src/commands/types.js";

function sample(id = "cmd-1"): Command {
  return { id, label: "Test", handler: vi.fn() };
}

describe("CommandRegistry", () => {
  it("registers and retrieves a command", () => {
    const reg = new CommandRegistry();
    reg.register(sample("undo"));
    expect(reg.get("undo")).toBeDefined();
    expect(reg.get("undo")?.id).toBe("undo");
  });

  it("returns undefined for unknown command", () => {
    const reg = new CommandRegistry();
    expect(reg.get("nope")).toBeUndefined();
  });

  it("unregisters a command", () => {
    const reg = new CommandRegistry();
    reg.register(sample("del"));
    reg.unregister("del");
    expect(reg.get("del")).toBeUndefined();
  });

  it("returns all registered commands", () => {
    const reg = new CommandRegistry();
    reg.register(sample("a"));
    reg.register(sample("b"));
    expect(reg.getAll()).toHaveLength(2);
  });

  it("executes command handler", () => {
    const fn = vi.fn();
    const reg = new CommandRegistry();
    reg.register({ id: "x", label: "X", handler: fn });
    reg.execute("x");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("does not execute when when() returns false", () => {
    const fn = vi.fn();
    const reg = new CommandRegistry();
    reg.register({
      id: "guarded",
      label: "Guarded",
      when: () => false,
      handler: fn,
    });
    reg.execute("guarded");
    expect(fn).not.toHaveBeenCalled();
  });

  it("executes when when() returns true", () => {
    const fn = vi.fn();
    const reg = new CommandRegistry();
    reg.register({
      id: "ok",
      label: "OK",
      when: () => true,
      handler: fn,
    });
    reg.execute("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("does nothing on execute for unknown command", () => {
    const reg = new CommandRegistry();
    expect(() => reg.execute("missing")).not.toThrow();
  });

  it("notifies subscribers on register", () => {
    const reg = new CommandRegistry();
    const listener = vi.fn();
    reg.subscribe(listener);
    reg.register(sample("n"));
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("notifies subscribers on unregister", () => {
    const reg = new CommandRegistry();
    reg.register(sample("x"));
    const listener = vi.fn();
    reg.subscribe(listener);
    reg.unregister("x");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("unsubscribe removes listener", () => {
    const reg = new CommandRegistry();
    const listener = vi.fn();
    const unsub = reg.subscribe(listener);
    unsub();
    reg.register(sample("y"));
    expect(listener).not.toHaveBeenCalled();
  });

  it("returns commands sorted by order", () => {
    const reg = new CommandRegistry();
    reg.register({ id: "b", label: "B", order: 2, handler: vi.fn() });
    reg.register({ id: "a", label: "A", order: 1, handler: vi.fn() });
    reg.register({ id: "c", label: "C", handler: vi.fn() });
    const all = reg.getAll();
    expect(all[0]?.id).toBe("a");
    expect(all[1]?.id).toBe("b");
    expect(all[2]?.id).toBe("c");
  });
});
