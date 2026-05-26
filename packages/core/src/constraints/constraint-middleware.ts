import type { ConstraintRegistry } from "./constraint-registry.js";
import type { ConstraintInput } from "./constraint-types.js";
import type { SceneGraph } from "../types.js";
import type { RuntimeAction } from "../runtime/actions.js";
import type { DispatchResult } from "../runtime/command-bus.js";

export function createConstraintMiddleware(
  registry: ConstraintRegistry,
) {
  return (
    action: RuntimeAction,
    state: SceneGraph,
    next: () => DispatchResult,
  ): DispatchResult => {
    const input: ConstraintInput = {
      scene: state,
      action,
    };

    if (action.type === "create-node" || action.type === "update-layout") {
      const nodeId = "nodeId" in action ? action.nodeId : action.node.id;
      input.node = state.nodes[nodeId] ?? ("node" in action ? action.node : undefined);
    } else if ("nodeId" in action) {
      input.node = state.nodes[action.nodeId];
    }

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
