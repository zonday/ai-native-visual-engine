import type { ActionRegistry } from "../engine/action-registry.js";
import type { Middleware } from "../engine/command-bus.js";
import {
  createCommandBus,
  extractErrorField,
  wrapCommandBus,
} from "../engine/command-bus.js";
import type { SceneGraph } from "../types.js";
import type { RuntimeAction } from "./register-handlers.js";
import type { RuntimeContext } from "./handler-registry.js";

export interface DispatchResult {
  ok: boolean;
  scene: SceneGraph;
  error?: { code: string; message: string; actionType?: string; nodeId?: string };
}

export type CommandBus = {
  dispatch(action: RuntimeAction): DispatchResult;
  getScene(): SceneGraph;
};

type RuntimeMiddleware = Middleware<SceneGraph, RuntimeAction>;

export function createRuntimeCommandBus(
  registry: ActionRegistry<RuntimeAction, SceneGraph, RuntimeContext>,
  middlewares: RuntimeMiddleware[],
  scene: SceneGraph,
  context: RuntimeContext,
) {
  const bus = createCommandBus(registry, middlewares, scene, context);
  const adapted = wrapCommandBus(bus, (result): DispatchResult => {
    const error = result.error
      ? {
          code: result.error.code,
          message: result.error.message,
          actionType: result.error.actionType,
          nodeId: extractErrorField(result.error, "nodeId"),
        }
      : undefined;
    return { ok: result.ok, scene: result.state, error };
  });
  return {
    dispatch: adapted.dispatch,
    getScene(): SceneGraph {
      return adapted.getState();
    },
  };
}
