import { createValidatorMiddleware } from "../../engine/middleware/validator.js";
import { DocumentActionSchema } from "../actions.js";
import type { DocumentMiddleware } from "../middleware.js";

export const documentValidatorMiddleware: DocumentMiddleware =
  createValidatorMiddleware(
    DocumentActionSchema,
    "validation.action-schema-mismatch",
  );
