import type { RuntimeAction } from "../runtime/actions.js";
import type { DispatchResult } from "../runtime/command-bus.js";
import type { SceneGraph } from "../types.js";
import type { ConstraintRegistry } from "./constraint-registry.js";
import type { ConstraintInput } from "./constraint-types.js";

export function createConstraintMiddleware(registry: ConstraintRegistry) {
  return (
    action: RuntimeAction,
    state: SceneGraph,
    next: () => DispatchResult,
  ): DispatchResult => {
    const input: ConstraintInput = {
      scene: state,
      action,
    };

    const report = registry.validate(input);
    if (!report.pass) {
      return {
        ok: false,
        scene: state,
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
