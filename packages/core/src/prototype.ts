import type { SceneNode } from "./types.js";

function generateId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  // Set version 4 and variant bits per RFC 4122
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(
    "",
  );
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export interface PrototypeComponent {
  id: string;
  name: string;
  description?: string;
  baseType: string;
  defaultProps: Record<string, unknown>;
  defaultStyle: Record<string, unknown>;
  defaultLayout?: Record<string, unknown>;
}

export interface ResolvedInstance {
  props: Record<string, unknown>;
  style: Record<string, unknown>;
  layout?: Record<string, unknown>;
}

export function resolveInstance(
  node: SceneNode,
  prototype: PrototypeComponent | undefined,
): ResolvedInstance {
  if (!node.prototypeId || !prototype || prototype.id !== node.prototypeId) {
    return {
      props: node.props ?? {},
      style: node.style ?? {},
      layout: node.layout ? { ...node.layout } : undefined,
    };
  }

  return {
    props: { ...prototype.defaultProps, ...(node.props ?? {}) },
    style: { ...prototype.defaultStyle, ...(node.style ?? {}) },
    layout: node.layout
      ? { ...node.layout }
      : prototype.defaultLayout
        ? { ...prototype.defaultLayout }
        : undefined,
  };
}

export function createNodeFromPrototype(
  prototype: PrototypeComponent,
  parentId: string,
  overrides?: {
    props?: Record<string, unknown>;
    style?: Record<string, unknown>;
    layout?: Record<string, unknown>;
  },
): SceneNode {
  return {
    id: generateId(),
    type: prototype.baseType,
    prototypeId: prototype.id,
    parentId,
    props: { ...(overrides?.props ?? {}) },
    style: { ...(overrides?.style ?? {}) },
    layout: overrides?.layout
      ? { ...overrides.layout }
      : prototype.defaultLayout
        ? { ...prototype.defaultLayout }
        : undefined,
  };
}

export function createPrototypeFromNode(
  node: SceneNode,
  name: string,
): PrototypeComponent {
  return {
    id: generateId(),
    name,
    baseType: node.type,
    defaultProps: { ...(node.props ?? {}) },
    defaultStyle: { ...(node.style ?? {}) },
    defaultLayout: node.layout ? { ...node.layout } : undefined,
  };
}

export function detachInstance(
  node: SceneNode,
  prototype: PrototypeComponent,
): SceneNode {
  const resolved = resolveInstance(node, prototype);
  return {
    ...node,
    prototypeId: undefined,
    props: resolved.props,
    style: resolved.style,
    layout: resolved.layout,
  };
}
