import type { SceneNode } from "@ai-native/core";
import { useMemo } from "react";
import type { z } from "zod";

export function useNodeProps<T extends z.ZodType>(
  node: SceneNode,
  schema: T,
): z.infer<T> {
  return useMemo(() => {
    const raw = (node.props ?? {}) as Record<string, unknown>;
    const parsed = schema.safeParse(raw);
    return parsed.success ? parsed.data : (schema.parse({}) as z.infer<T>);
  }, [node.props, schema]);
}
