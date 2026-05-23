import type { DocumentMiddleware } from "../middleware.js";

export const documentUndoHistoryMiddleware: DocumentMiddleware = (
  _action,
  _doc,
  next,
) => {
  return next();
};
