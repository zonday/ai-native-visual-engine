import { formatZodIssues } from "./diagnostics.js";
import { actionExpansionStage } from "./stages/action-expansion.js";
import { constraintPrecheckStage } from "./stages/constraint-precheck.js";
import { intentExpansionStage } from "./stages/intent-expansion.js";
import { layoutPlanningStage } from "./stages/layout-planning.js";
import { normalizeStage } from "./stages/normalize.js";
import { validationStage } from "./stages/validation.js";
import type {
  CompileResult,
  CompilerContext,
  CompilerStage,
  ExecutionPlan,
  SemanticAction,
  SemanticDiagnostic,
} from "./types.js";
import { SemanticActionSchema } from "./types.js";

const stages: CompilerStage<unknown, unknown>[] = [
  normalizeStage,
  intentExpansionStage,
  constraintPrecheckStage,
  layoutPlanningStage,
  actionExpansionStage,
  validationStage,
];

export function compileSemanticAction(
  action: SemanticAction,
  context: CompilerContext = {},
): CompileResult {
  const parsed = SemanticActionSchema.safeParse(action);
  if (!parsed.success) {
    return {
      ok: false,
      diagnostics: [
        {
          code: "compiler.invalid-action",
          message: formatZodIssues(parsed.error),
          severity: "error",
        },
      ],
    };
  }

  const diagnostics: SemanticDiagnostic[] = [];

  let current: unknown = parsed.data;

  for (const stage of stages) {
    const result = stage.run(current, context);

    if (!result.ok) {
      diagnostics.push(...result.diagnostics);
      return { ok: false, diagnostics };
    }

    current = result.output;
  }

  return { ok: true, plan: current as ExecutionPlan };
}
