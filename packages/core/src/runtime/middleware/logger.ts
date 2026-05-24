import type { RuntimeMiddleware } from "../middleware.js";

export const runtimeLoggerMiddleware: RuntimeMiddleware = (
  _action,
  _scene,
  next,
) => {
  return next();
};
