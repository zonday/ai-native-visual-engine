import type { ComponentPlugin } from "../plugin-types.js";

export class ComponentPluginRegistry {
  private plugins = new Map<string, ComponentPlugin>();

  register(plugin: ComponentPlugin): void {
    if (this.plugins.has(plugin.type)) {
      throw new Error(
        `Component plugin "${plugin.type}" is already registered`,
      );
    }
    this.plugins.set(plugin.type, plugin);
  }

  get(type: string): ComponentPlugin | undefined {
    return this.plugins.get(type);
  }

  list(): ComponentPlugin[] {
    return [...this.plugins.values()];
  }

  getTypes(): string[] {
    return [...this.plugins.keys()];
  }

  has(type: string): boolean {
    return this.plugins.has(type);
  }

  get size(): number {
    return this.plugins.size;
  }
}

export function createPluginRegistry(
  plugins: ComponentPlugin[],
): ComponentPluginRegistry {
  const registry = new ComponentPluginRegistry();
  for (const plugin of plugins) {
    registry.register(plugin);
  }
  return registry;
}
