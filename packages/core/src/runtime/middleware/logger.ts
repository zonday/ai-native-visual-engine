import { isDev } from "../../engine/command-bus.js";
import type { RuntimeMiddleware } from "../middleware.js";

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
