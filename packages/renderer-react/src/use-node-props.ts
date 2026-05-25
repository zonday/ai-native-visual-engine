import type { SceneNode } from "@ai-native/core";
import type { z } from "zod";

export function useNodeProps<T extends z.ZodType>(
  node: SceneNode,
  schema: T,
): z.infer<T> {
  const raw = (node.props ?? {}) as Record<string, unknown>;
  const parsed = schema.safeParse(raw);
  return parsed.success ? parsed.data : (schema.parse({}) as z.infer<T>);
}
