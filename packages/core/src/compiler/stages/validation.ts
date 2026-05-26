import { DocumentActionSchema } from "../../document/actions.js";
import { RuntimeActionSchema } from "../../runtime/actions.js";
import type {
  CompilerContext,
  CompilerStage,
  ExecutionPlan,
  SemanticDiagnostic,
  StageOutcome,
} from "../types.js";

function diagnostic(
  code: string,
  message: string,
  stage = "validation",
): SemanticDiagnostic {
  return { code, message, severity: "error", stage };
}

export const validationStage: CompilerStage<ExecutionPlan, ExecutionPlan> = {
  name: "validation",

  run(
    plan: ExecutionPlan,
    _context: CompilerContext,
  ): StageOutcome<ExecutionPlan> {
    const diagnostics: SemanticDiagnostic[] = [];

    if (!plan || typeof plan !== "object") {
      return {
        ok: false,
        diagnostics: [
          diagnostic(
            "compiler.invalid-plan",
            "ExecutionPlan must be a non-null object",
          ),
        ],
      };
    }

    if (!Array.isArray(plan.documentActions)) {
      diagnostics.push(
        diagnostic(
          "compiler.invalid-document-actions",
          "documentActions must be an array",
        ),
      );
    } else {
      for (const action of plan.documentActions) {
        const parsed = DocumentActionSchema.safeParse(action);
        if (!parsed.success) {
          diagnostics.push(
            diagnostic(
              "compiler.invalid-document-action",
              `Invalid document action: ${parsed.error.issues.map((i) => i.message).join("; ")}`,
            ),
          );
        }
      }
    }

    if (!Array.isArray(plan.runtimeActions)) {
      diagnostics.push(
        diagnostic(
          "compiler.invalid-runtime-actions",
          "runtimeActions must be an array",
        ),
      );
    } else {
      for (const action of plan.runtimeActions) {
        const parsed = RuntimeActionSchema.safeParse(action);
        if (!parsed.success) {
          diagnostics.push(
            diagnostic(
              "compiler.invalid-runtime-action",
              `Invalid runtime action: ${parsed.error.issues.map((i) => i.message).join("; ")}`,
            ),
          );
        }
      }
    }

    if (diagnostics.length > 0) {
      return { ok: false, diagnostics };
    }

    return { ok: true, output: plan };
  },
};
