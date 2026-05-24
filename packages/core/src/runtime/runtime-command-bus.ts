import type { SceneGraph } from "../types.js";
import type { RuntimeAction } from "./actions.js";
import type { DispatchResult } from "./command-bus.js";
import { RuntimeHandlerError } from "./error.js";
import type { RuntimeContext } from "./handler.js";
import type { RuntimeHandlerRegistry } from "./handler-registry.js";
import type { RuntimeMiddleware } from "./middleware.js";

function deepFreeze<T>(value: T, seen?: WeakSet<object>): T {
  if (value === null || typeof value !== "object") return value;
  if (Object.isFrozen(value)) return value;
  seen ??= new WeakSet();
  if (seen.has(value)) return value;
  seen.add(value);
  for (const key of Reflect.ownKeys(value)) {
    deepFreeze((value as Record<symbol | string, unknown>)[key], seen);
  }
  return Object.freeze(value);
}

function detectMutation(
  sceneBefore: SceneGraph,
  sceneAfter: SceneGraph,
  action: RuntimeAction,
): void {
  if (sceneAfter === sceneBefore) {
    console.warn(
      `[immutability] handler for "${action.type}" returned same object reference. Handlers must return a new scene, not mutate in place.`,
    );
  }
}

declare const process: { env: Record<string, string | undefined> } | undefined;
const isDev =
  typeof process !== "undefined" && process.env.NODE_ENV !== "production";

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
            detectMutation(sceneBefore, runningScene, action);
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
