import type { ComponentPluginRegistry } from "../plugin-registry.js";
import type {
  ComponentCapabilities,
  ComponentConstraint,
  ComponentPlugin,
} from "../plugin-types.js";

export interface AiPropEntry {
  key: string;
  type: string;
  required: boolean;
  description?: string;
  defaultValue?: unknown;
}

export interface AiComponentEntry {
  type: string;
  name: string;
  description: string;
  category?: string;
  props: AiPropEntry[];
  layoutCapabilities?: ComponentCapabilities;
  constraints?: ComponentConstraint[];
  ai?: {
    usage?: string[];
    antiPatterns?: string[];
    relatedComponents?: string[];
    keywords?: string[];
  };
}

export interface AiSchemaIndex {
  components: Map<string, AiComponentEntry>;
  componentTypes: string[];
}

export interface AiSchemaIndexSnapshot {
  components: Record<string, AiComponentEntry>;
  componentTypes: string[];
}

function toAiPropEntry(prop: {
  key: string;
  type: string;
  required?: boolean;
  description?: string;
  default?: unknown;
}): AiPropEntry {
  return {
    key: prop.key,
    type: prop.type,
    required: prop.required ?? false,
    description: prop.description,
    defaultValue: prop.default,
  };
}

function toAiComponentEntry(plugin: ComponentPlugin): AiComponentEntry {
  return {
    type: plugin.type,
    name: plugin.meta.title,
    description: plugin.meta.description,
    category: plugin.meta.category,
    props: plugin.meta.props.map(toAiPropEntry),
    layoutCapabilities: plugin.capabilities,
    constraints: plugin.constraints ?? plugin.meta.constraints,
    ai: plugin.meta.ai,
  };
}

export function buildSchemaIndex(
  registry: ComponentPluginRegistry,
): AiSchemaIndex {
  const plugins = registry.list();
  const components = new Map<string, AiComponentEntry>();

  for (const plugin of plugins) {
    const entry = toAiComponentEntry(plugin);
    components.set(entry.type, entry);
  }

  return {
    components,
    componentTypes: [...components.keys()],
  };
}

export function schemaIndexToSnapshot(
  index: AiSchemaIndex,
): AiSchemaIndexSnapshot {
  const entries = [...index.components.entries()];
  const record: Record<string, AiComponentEntry> = {};
  for (const [key, value] of entries) {
    record[key] = value;
  }
  return {
    components: record,
    componentTypes: index.componentTypes,
  };
}
