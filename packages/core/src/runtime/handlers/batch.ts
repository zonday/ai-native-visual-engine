import type { SceneGraph } from "../../types.js";
import type { BatchActions, RuntimeAction } from "../actions.js";
import { RuntimeActionSchema } from "../actions.js";
import type { DispatchResult } from "../command-bus.js";
import { RuntimeHandlerError } from "../error.js";
import type { RuntimeContext, RuntimeHandler } from "../handler.js";
import type { InverseComputer } from "../inverse-registry.js";

function flattenBatchActions(actions: RuntimeAction[]): RuntimeAction[] {
  const flat: RuntimeAction[] = [];
  for (const action of actions) {
    if (action.type === "batch-actions") {
      const batch = action as BatchActions;
      flat.push(...flattenBatchActions(batch.actions as RuntimeAction[]));
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
      const parsed = RuntimeActionSchema.safeParse(child);
      if (!parsed.success) {
        throw new RuntimeHandlerError(
          "scene.batch-invalid-child-action",
          `Child action validation failed: ${parsed.error.message}`,
          "batch-actions",
        );
      }
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
  dispatch: (action: RuntimeAction) => DispatchResult,
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
    const result = dispatch(child);
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
