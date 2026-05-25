import type { SceneNode } from "./types.js";

export interface PropMeta {
  key: string;
  type: "string" | "number" | "boolean" | "json";
  default?: unknown;
  required?: boolean;
  description?: string;
}

export interface SlotMeta {
  key: string;
  title: string;
  allowedTypes?: string[];
  required?: boolean;
}

export interface EventMeta {
  key: string;
  title: string;
  description?: string;
}

export interface Example {
  title: string;
  props: Record<string, unknown>;
  description?: string;
}

export interface ComponentConstraint {
  type: "structural" | "layout" | "semantic" | "theme";
  rule: string;
}

export interface ComponentDefaults {
  props?: Record<string, unknown>;
  style?: Record<string, unknown>;
  layout?: Partial<Record<string, unknown>>;
}

export interface ComponentCapabilities {
  canHaveChildren?: boolean;
  canResize?: boolean;
  canRotate?: boolean;
  allowedParentTypes?: string[];
  allowedChildTypes?: string[];
}

export interface ComponentMeta {
  title: string;
  description: string;
  category?: string;
  props: PropMeta[];
  slots?: SlotMeta[];
  events?: EventMeta[];
  examples?: Example[];
  constraints?: ComponentConstraint[];
  ai?: {
    usage?: string[];
    antiPatterns?: string[];
    relatedComponents?: string[];
    keywords?: string[];
  };
}

export type Renderer = (
  node: SceneNode,
  ctx: unknown,
  children?: unknown[],
) => unknown;

export interface ComponentPlugin {
  type: string;
  renderer: Renderer;
  meta: ComponentMeta;
  constraints?: ComponentConstraint[];
  defaults?: ComponentDefaults;
  capabilities?: ComponentCapabilities;
}
