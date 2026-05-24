import { createCommandBus } from "../engine/command-bus.js";
import type { SceneGraph } from "../types.js";
import type { RuntimeAction } from "./actions.js";
import type { DispatchResult } from "./command-bus.js";
import { RuntimeHandlerError } from "./error.js";
import type { RuntimeContext } from "./handler.js";
import type { RuntimeHandlerRegistry } from "./handler-registry.js";
import type { RuntimeMiddleware } from "./middleware.js";

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
          error: result.error,
        };
      } catch (err) {
        if (err instanceof RuntimeHandlerError) {
          return {
            ok: false,
            scene: bus.getState(),
            error: {
              code: err.code,
              message: err.message,
              actionType: err.actionType ?? action.type,
              nodeId: err.nodeId,
            },
          };
        }
        return {
          ok: false,
          scene: bus.getState(),
          error: {
            code: "scene.handler-error",
            message: err instanceof Error ? err.message : "Unknown error",
            actionType: action.type,
          },
        };
      }
    },
    getScene(): SceneGraph {
      return bus.getState();
    },
  };
}
