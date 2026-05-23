import { DocumentActionSchema } from "../actions.js";
import type { DocumentMiddleware } from "../middleware.js";

export const documentValidatorMiddleware: DocumentMiddleware = (
  action,
  doc,
  next,
) => {
  const result = DocumentActionSchema.safeParse(action);
  if (!result.success) {
    return {
      ok: false,
      document: doc,
      error: {
        code: "validation.action-schema-mismatch",
        message: result.error.message,
        actionType: action.type,
      },
    };
  }
  return next();
};
