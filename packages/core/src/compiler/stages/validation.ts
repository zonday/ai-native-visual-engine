import { DocumentActionSchema } from "../../document/register-handlers.js";
import { RuntimeActionSchema } from "../../runtime/register-handlers.js";
import { createDiagnosticFactory, formatZodIssues } from "../diagnostics.js";
import type {
  CompilerContext,
  CompilerStage,
  ExecutionPlan,
  SemanticDiagnostic,
  StageOutcome,
} from "../types.js";

const diag = createDiagnosticFactory("validation");

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
          diag(
            "compiler.invalid-plan",
            "ExecutionPlan must be a non-null object",
          ),
        ],
      };
    }

    if (!Array.isArray(plan.documentActions)) {
      diagnostics.push(
        diag(
          "compiler.invalid-document-actions",
          "documentActions must be an array",
        ),
      );
    } else {
      for (const action of plan.documentActions) {
        const parsed = DocumentActionSchema.safeParse(action);
        if (!parsed.success) {
          diagnostics.push(
            diag(
              "compiler.invalid-document-action",
              `Invalid document action: ${formatZodIssues(parsed.error)}`,
            ),
          );
        }
      }
    }

    if (!Array.isArray(plan.runtimeActions)) {
      diagnostics.push(
        diag(
          "compiler.invalid-runtime-actions",
          "runtimeActions must be an array",
        ),
      );
    } else {
      for (const action of plan.runtimeActions) {
        const parsed = RuntimeActionSchema.safeParse(action);
        if (!parsed.success) {
          diagnostics.push(
            diag(
              "compiler.invalid-runtime-action",
              `Invalid runtime action: ${formatZodIssues(parsed.error)}`,
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
