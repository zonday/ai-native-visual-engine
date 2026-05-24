import type { RuntimeMiddleware } from "../middleware.js";

declare const process: { env: Record<string, string | undefined> } | undefined;
const isDev =
  typeof process !== "undefined" && process.env.NODE_ENV !== "production";

export const runtimeLoggerMiddleware: RuntimeMiddleware = (
  action,
  scene,
  next,
) => {
  if (isDev) {
    console.debug("[scene-runtime]", action.type, {
      sceneVersion: scene.version,
      action,
    });
  }
  const result = next();
  if (isDev && !result.ok) {
    console.warn("[scene-runtime] dispatch failed:", result.error);
  }
  return result;
};
