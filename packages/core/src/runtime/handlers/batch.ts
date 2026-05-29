import { HandlerError } from "../../engine/error.js";
import type { SceneGraph } from "../../types.js";
import type { BatchActions, RuntimeAction } from "../actions.js";
import { RuntimeActionSchema } from "../actions.js";
import type { DispatchResult } from "../command-bus.js";
import type { RuntimeContext, RuntimeHandler } from "../handler.js";
import type {
  InverseComputer,
  InverseRegistry,
  RuntimeHandlerRegistry,
} from "../handler-registry.js";
import { computeInverseAction } from "../handler-registry.js";

const MAX_BATCH_DEPTH = 50;

function flattenBatchActions(
  actions: RuntimeAction[],
  depth: number = 0,
): RuntimeAction[] {
  if (depth > MAX_BATCH_DEPTH) return [];
  const flat: RuntimeAction[] = [];
  for (const action of actions) {
    if (action.type === "batch-actions") {
      const batch = action as BatchActions;
      flat.push(
        ...flattenBatchActions(batch.actions as RuntimeAction[], depth + 1),
      );
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
        throw new HandlerError(
          "scene.batch-item-failed",
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

export function createBatchInverse(
  handlerRegistry: RuntimeHandlerRegistry,
  inverseRegistry: InverseRegistry,
): InverseComputer<BatchActions> {
  return (sceneBefore, action, context) => {
    const dispatch = (
      sceneForAction: SceneGraph,
      childAction: RuntimeAction,
    ): DispatchResult => {
      const entry = handlerRegistry.get(childAction.type);
      if (!entry) {
        return {
          ok: false,
          scene: sceneForAction,
          error: {
            code: "scene.unknown-action-type",
            message: `Unknown action type: ${childAction.type}`,
            actionType: childAction.type,
          },
        };
      }
      try {
        const next = entry.handler(sceneForAction, childAction, context);
        return { ok: true, scene: next };
      } catch (err) {
        return {
          ok: false,
          scene: sceneForAction,
          error: {
            code: "scene.handler-error",
            message: err instanceof Error ? err.message : String(err),
            actionType: childAction.type,
          },
        };
      }
    };

    const inverseOf = (s: SceneGraph, a: RuntimeAction, ctx: RuntimeContext) =>
      computeInverseAction(inverseRegistry, s, a, ctx);

    return computeBatchInverse(
      sceneBefore,
      action,
      dispatch,
      context,
      inverseOf,
    );
  };
}
