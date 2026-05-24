import { deepFreeze, detectSameRef, isDev } from "../engine/command-bus.js";
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
  let currentScene = scene;
  return {
    dispatch(action: RuntimeAction): DispatchResult {
      const entry = registry.get(action.type);
      if (!entry) {
        return {
          ok: false,
          scene: currentScene,
          error: {
            code: "scene.unknown-action-type",
            message: `Unknown runtime action type: ${action.type}`,
            actionType: action.type,
          },
        };
      }

      const handler = entry.handler;
      let runningScene = currentScene;
      const chain = [...middlewares];

      function runChain(): DispatchResult {
        if (chain.length === 0) {
          if (isDev) {
            const sceneBefore = runningScene;
            deepFreeze(runningScene);
            runningScene = handler(runningScene, action, context);
            detectSameRef(sceneBefore, runningScene, action);
          } else {
            runningScene = handler(runningScene, action, context);
          }
          return { ok: true, scene: runningScene };
        }
        const mw = chain.shift();
        if (!mw)
          return {
            ok: false,
            scene: runningScene,
            error: {
              code: "scene.middleware-error",
              message: "Middleware chain broken",
            },
          };
        return mw(action, runningScene, runChain);
      }

      try {
        const result = runChain();
        if (result.ok) {
          currentScene = result.scene;
        }
        return result;
      } catch (err) {
        if (err instanceof RuntimeHandlerError) {
          return {
            ok: false,
            scene: runningScene,
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
          scene: runningScene,
          error: {
            code: "scene.handler-error",
            message: err instanceof Error ? err.message : "Unknown error",
            actionType: action.type,
          },
        };
      }
    },
    getScene(): SceneGraph {
      return currentScene;
    },
  };
}
