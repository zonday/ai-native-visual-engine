import type { Middleware } from "../engine/command-bus.js";
import type { RuntimeAction } from "../runtime/register-handlers.js";
import type { SceneGraph } from "../types.js";
import type { ConstraintRegistry } from "./constraint-registry.js";
import type { ConstraintInput } from "./constraint-types.js";

export function createConstraintMiddleware(
  registry: ConstraintRegistry,
): Middleware<SceneGraph, RuntimeAction> {
  return (action, state, next) => {
    const input: ConstraintInput = {
      scene: state,
      action,
    };

    const report = registry.validate(input);
    if (!report.pass) {
      return {
        ok: false,
        state,
        error: {
          code: "constraint.violation",
          message: report.violations
            .filter((v) => v.severity === "error")
            .map((v) => `[${v.code}] ${v.message}`)
            .join("; "),
          actionType: action.type,
        },
      };
    }

    return next();
  };
}
