import { useSyncExternalStore } from "react";
import { commandRegistry } from "../commands/command-registry.js";
import type { Command } from "../commands/types.js";

export function useCommands(): Command[] {
  return useSyncExternalStore(
    (cb) => commandRegistry.subscribe(cb),
    () => commandRegistry.getAll(),
  );
}
