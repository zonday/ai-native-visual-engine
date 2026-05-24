import { createValidatorMiddleware } from "../../engine/middleware/validator.js";
import { RuntimeActionSchema } from "../actions.js";
import type { RuntimeMiddleware } from "../middleware.js";

export const runtimeValidatorMiddleware: RuntimeMiddleware =
  createValidatorMiddleware(
    RuntimeActionSchema,
    "validation.action-schema-mismatch",
  );
