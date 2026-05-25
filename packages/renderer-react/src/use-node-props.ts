import type { SceneNode } from "@ai-native/core";

export function useNodeProps<T extends Record<string, unknown>>(
  node: SceneNode,
): T {
  return (node.props ?? {}) as T;
}
