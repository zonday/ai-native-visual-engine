// @vitest-environment happy-dom

import { cleanup, render } from "@testing-library/react";
import { useRef } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useHotkey } from "../src/hooks/use-hotkey.js";

function TestHarness({
  onUndo,
  onRedo,
  onDelete,
}: {
  onUndo?: () => void;
  onRedo?: () => void;
  onDelete?: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  useHotkey([
    { key: "z", ctrl: true, handler: () => onUndo?.() },
    { key: "y", ctrl: true, handler: () => onRedo?.() },
    { key: "z", ctrl: true, shift: true, handler: () => onRedo?.() },
    { key: "delete", handler: () => onDelete?.() },
    { key: "backspace", handler: () => onDelete?.() },
  ]);

  return (
    <div>
      <span data-testid="output" />
      <input ref={inputRef} data-testid="text-input" type="text" />
    </div>
  );
}

function fireKey(key: string, mods?: { ctrl?: boolean; shift?: boolean }) {
  window.dispatchEvent(
    new KeyboardEvent("keydown", {
      key,
      ctrlKey: mods?.ctrl ?? false,
      metaKey: mods?.ctrl ?? false,
      shiftKey: mods?.shift ?? false,
      bubbles: true,
      cancelable: true,
    }),
  );
}

describe("useHotkey", () => {
  beforeEach(() => {
    cleanup();
  });

  it("calls undo handler on Ctrl+Z", () => {
    const onUndo = vi.fn();
    render(<TestHarness onUndo={onUndo} />);
    fireKey("z", { ctrl: true });
    expect(onUndo).toHaveBeenCalledTimes(1);
  });

  it("calls redo handler on Ctrl+Y", () => {
    const onRedo = vi.fn();
    render(<TestHarness onRedo={onRedo} />);
    fireKey("y", { ctrl: true });
    expect(onRedo).toHaveBeenCalledTimes(1);
  });

  it("calls redo handler on Ctrl+Shift+Z", () => {
    const onRedo = vi.fn();
    render(<TestHarness onRedo={onRedo} />);
    fireKey("z", { ctrl: true, shift: true });
    expect(onRedo).toHaveBeenCalledTimes(1);
  });

  it("does not fire undo on plain Z without ctrl", () => {
    const onUndo = vi.fn();
    render(<TestHarness onUndo={onUndo} />);
    fireKey("z");
    expect(onUndo).not.toHaveBeenCalled();
  });

  it("calls delete handler on Delete key", () => {
    const onDelete = vi.fn();
    render(<TestHarness onDelete={onDelete} />);
    fireKey("delete");
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("calls delete handler on Backspace key", () => {
    const onDelete = vi.fn();
    render(<TestHarness onDelete={onDelete} />);
    fireKey("backspace");
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("does not fire shortcut when input is focused", () => {
    const onUndo = vi.fn();
    const { container } = render(<TestHarness onUndo={onUndo} />);
    const input = container.querySelector("input") as HTMLInputElement;
    input.focus();
    fireKey("z", { ctrl: true });
    expect(onUndo).not.toHaveBeenCalled();
  });

  it("fires shortcut when input is not focused", () => {
    const onUndo = vi.fn();
    const { container } = render(<TestHarness onUndo={onUndo} />);
    const input = container.querySelector("input") as HTMLInputElement;
    input.focus();
    input.blur();
    fireKey("z", { ctrl: true });
    expect(onUndo).toHaveBeenCalledTimes(1);
  });

  it("does not fire unregistered key combo", () => {
    const onUndo = vi.fn();
    render(<TestHarness onUndo={onUndo} />);
    fireKey("a", { ctrl: true });
    expect(onUndo).not.toHaveBeenCalled();
  });
});
