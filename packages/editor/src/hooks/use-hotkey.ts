import { useEffect, useRef } from "react";
import type { HotkeyBinding } from "../commands/types.js";

function isInputFocused(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    return true;
  }
  if (el instanceof HTMLElement && el.isContentEditable) {
    return true;
  }
  return false;
}

export function useHotkey(
  bindings: (HotkeyBinding & { handler: () => void })[],
): void {
  const bindingsRef = useRef(bindings);
  bindingsRef.current = bindings;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isInputFocused()) return;

      for (const b of bindingsRef.current) {
        const ctrlMatch = b.ctrl
          ? e.ctrlKey || e.metaKey
          : !(e.ctrlKey || e.metaKey);
        const shiftMatch =
          b.shift === undefined ? !e.shiftKey : b.shift === e.shiftKey;
        if (
          ctrlMatch &&
          shiftMatch &&
          e.key.toLowerCase() === b.key.toLowerCase()
        ) {
          e.preventDefault();
          b.handler();
          return;
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
