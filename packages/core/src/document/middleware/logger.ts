import type { DocumentMiddleware } from "../middleware.js";

export const documentLoggerMiddleware: DocumentMiddleware = (
  _action,
  _doc,
  next,
) => {
  return next();
};
