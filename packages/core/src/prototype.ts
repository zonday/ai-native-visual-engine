import type { SceneNode } from "./types.js";

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
    id: crypto.randomUUID(),
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
    id: crypto.randomUUID(),
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
