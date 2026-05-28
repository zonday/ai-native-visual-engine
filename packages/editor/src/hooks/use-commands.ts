import { useEffect, useState } from "react";
import { commandRegistry } from "../commands/command-registry.js";
import type { Command } from "../commands/types.js";

export function useCommands(): Command[] {
  const [commands, setCommands] = useState(() => commandRegistry.getAll());

  useEffect(() => {
    return commandRegistry.subscribe(() => {
      setCommands(commandRegistry.getAll());
    });
  }, []);

  return commands;
}
