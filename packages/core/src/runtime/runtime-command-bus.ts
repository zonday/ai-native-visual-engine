import { createCommandBus } from "../engine/command-bus.js";
import { HandlerError } from "../engine/error.js";
import type { SceneGraph } from "../types.js";
import type { RuntimeAction } from "./actions.js";
import type { DispatchResult, RuntimeError } from "./command-bus.js";
import type { RuntimeContext } from "./handler.js";
import type { RuntimeHandlerRegistry } from "./handler-registry.js";
import type { RuntimeMiddleware } from "./middleware.js";

function toRuntimeError(err: unknown, actionType: string): RuntimeError {
  if (err instanceof HandlerError) {
    return {
      code: err.code,
      message: err.message,
      actionType: err.actionType ?? actionType,
      nodeId: err.context.nodeId as string | undefined,
    };
  }
  return {
    code: "scene.handler-error",
    message: err instanceof Error ? err.message : String(err),
    actionType,
  };
}

export function createRuntimeCommandBus(
  registry: RuntimeHandlerRegistry,
  middlewares: RuntimeMiddleware[],
  scene: SceneGraph,
  context: RuntimeContext,
) {
  const bus = createCommandBus(registry, middlewares, scene, context);
  return {
    dispatch(action: RuntimeAction): DispatchResult {
      try {
        const result = bus.dispatch(action);
        return {
          ok: result.ok,
          scene: result.state,
          error: result.error
            ? {
                code: result.error.code,
                message: result.error.message,
                actionType: result.error.actionType,
              }
            : undefined,
        };
      } catch (err) {
        return {
          ok: false,
          scene: bus.getState(),
          error: toRuntimeError(err, action.type),
        };
      }
    },
    getScene(): SceneGraph {
      return bus.getState();
    },
  };
}
