import type { Command } from "./types.js";

export class CommandRegistry {
  private commands = new Map<string, Command>();
  private listeners = new Set<() => void>();

  register(command: Command): void {
    this.commands.set(command.id, command);
    this.notify();
  }

  unregister(id: string): void {
    this.commands.delete(id);
    this.notify();
  }

  get(id: string): Command | undefined {
    return this.commands.get(id);
  }

  getAll(): Command[] {
    return [...this.commands.values()].sort(
      (a, b) => (a.order ?? 99) - (b.order ?? 99),
    );
  }

  execute(id: string): void {
    const cmd = this.commands.get(id);
    if (!cmd) return;
    if (cmd.when && !cmd.when()) return;
    cmd.handler();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}

export const commandRegistry = new CommandRegistry();
