import { z } from "zod/v4";
import type { SceneGraph } from "../../types.js";
import type {
  InverseComputer,
  InverseRegistry,
  RuntimeContext,
  RuntimeHandler,
  RuntimeHandlerRegistry,
} from "../handler-registry.js";
import { computeInverseAction } from "../handler-registry.js";
import type { RuntimeAction } from "../register-handlers.js";
import type { DispatchResult } from "../runtime-command-bus.js";

export const BatchActionsSchema = z.object({
  type: z.literal("batch-actions"),
  actions: z.array(z.any()),
});

export type BatchActions = z.infer<typeof BatchActionsSchema>;

const MAX_BATCH_DEPTH = 50;

function flattenBatchActions(
  actions: RuntimeAction[],
  depth: number = 0,
): RuntimeAction[] {
  if (depth > MAX_BATCH_DEPTH) return [];
  const flat: RuntimeAction[] = [];
  for (const action of actions) {
    if (action.type === "batch-actions") {
      const batch = action as unknown as { actions: RuntimeAction[] };
      flat.push(...flattenBatchActions(batch.actions, depth + 1));
    } else {
      flat.push(action);
    }
  }
  return flat;
}

export function createBatchHandler(
  dispatch: (action: RuntimeAction) => DispatchResult,
): RuntimeHandler<BatchActions> {
  return (scene, action, _ctx) => {
    const original = scene;
    const flat = flattenBatchActions(action.actions as RuntimeAction[]);
    let current = scene;
    for (const child of flat) {
      const result = dispatch(child);
      if (!result.ok) return original;
      current = result.scene;
    }
    return current;
  };
}

export function computeBatchInverse(
  sceneBefore: SceneGraph,
  action: BatchActions,
  dispatch: (scene: SceneGraph, action: RuntimeAction) => DispatchResult,
  context: RuntimeContext,
  inverseOf: (
    sceneBefore: SceneGraph,
    action: RuntimeAction,
    ctx: RuntimeContext,
  ) => RuntimeAction | undefined,
): RuntimeAction | undefined {
  const flat = flattenBatchActions(action.actions as RuntimeAction[]);
  if (flat.length === 0) return undefined;

  const inverses: RuntimeAction[] = [];
  let currentScene = sceneBefore;
  for (const child of flat) {
    const inv = inverseOf(currentScene, child, context);
    if (inv) inverses.push(inv);
    const result = dispatch(currentScene, child);
    if (!result.ok) break;
    currentScene = result.scene;
  }

  if (inverses.length === 0) return undefined;
  if (inverses.length === 1) return inverses[0];

  return {
    type: "batch-actions",
    actions: inverses.reverse(),
  };
}

export const batchInverse: InverseComputer<BatchActions> = (
  _sceneBefore,
  _action,
  _context,
) => {
  return undefined;
};

