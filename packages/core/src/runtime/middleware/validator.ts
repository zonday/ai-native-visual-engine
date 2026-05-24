import { RuntimeActionSchema } from "../actions.js";
import type { RuntimeMiddleware } from "../middleware.js";

export const runtimeValidatorMiddleware: RuntimeMiddleware = (
  action,
  scene,
  next,
) => {
  const result = RuntimeActionSchema.safeParse(action);
  if (!result.success) {
    return {
      ok: false,
      scene,
      error: {
        code: "validation.action-schema-mismatch",
        message: result.error.message,
        actionType: action.type,
      },
    };
  }
  return next();
};
