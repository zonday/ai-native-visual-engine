import type { z } from "zod/v4";
import type { Middleware } from "../command-bus.js";

export function createValidatorMiddleware<
  TState,
  TAction extends { type: string },
>(
  schema: z.ZodType<TAction>,
  errorCode = "validation.action-schema-mismatch",
): Middleware<TState, TAction> {
  return (action, state, next) => {
    const result = schema.safeParse(action);
    if (!result.success) {
      return {
        ok: false,
        state,
        error: {
          code: errorCode,
          message: result.error.message,
          actionType: action.type,
        },
      };
    }
    return next();
  };
}
