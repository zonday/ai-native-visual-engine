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
  if (!node.prototypeId || !prototype) {
    return {
      props: node.props ?? {},
      style: (node.style as Record<string, unknown>) ?? {},
      layout: (node.layout as Record<string, unknown> | undefined) ?? undefined,
    };
  }

  return {
    props: { ...prototype.defaultProps, ...(node.props ?? {}) },
    style: {
      ...prototype.defaultStyle,
      ...((node.style as Record<string, unknown>) ?? {}),
    },
    layout:
      (node.layout as Record<string, unknown> | undefined) ??
      prototype.defaultLayout,
  };
}

export function createNodeFromPrototype(
  prototype: PrototypeComponent,
  parentId: string,
  overrides?: Partial<SceneNode>,
): SceneNode {
  return {
    id: `node-${crypto.randomUUID().slice(0, 8)}`,
    type: prototype.baseType,
    prototypeId: prototype.id,
    parentId,
    props: { ...(overrides?.props ?? {}) },
    style: { ...(overrides?.style ?? {}) },
    layout: overrides?.layout ?? prototype.defaultLayout,
  };
}

export function createPrototypeFromNode(
  node: SceneNode,
  name: string,
): PrototypeComponent {
  return {
    id: `proto-${crypto.randomUUID().slice(0, 8)}`,
    name,
    baseType: node.type,
    defaultProps: { ...(node.props ?? {}) },
    defaultStyle: { ...((node.style as Record<string, unknown>) ?? {}) },
    defaultLayout: (node.layout as Record<string, unknown> | undefined)
      ? { ...(node.layout as Record<string, unknown>) }
      : undefined,
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
