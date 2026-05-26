import { actionExpansionStage } from "./stages/action-expansion.js";
import { normalizeStage } from "./stages/normalize.js";
import type {
  CompileResult,
  CompilerContext,
  CompilerStage,
  ExecutionPlan,
  NormalizedSemanticAction,
  SemanticAction,
  SemanticDiagnostic,
} from "./types.js";

function passThroughStage<T>(name: string): CompilerStage<T, T> {
  return {
    name,
    run(input: T, _context: CompilerContext) {
      return { ok: true as const, output: input };
    },
  };
}

const intentExpansionStage =
  passThroughStage<NormalizedSemanticAction>("intent-expansion");
const constraintPrecheckStage = passThroughStage<NormalizedSemanticAction>(
  "constraint-precheck",
);
const layoutPlanningStage =
  passThroughStage<NormalizedSemanticAction>("layout-planning");
const validationStage = passThroughStage<ExecutionPlan>("validation");

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
  const diagnostics: SemanticDiagnostic[] = [];

  let current: unknown = action;

  for (const stage of stages) {
    const result = stage.run(current, context);

    if (!result.ok) {
      diagnostics.push(...result.diagnostics);
      return { ok: false, diagnostics };
    }

    current = result.output;
  }

  // Invariant: after validationStage, current is guaranteed to be ExecutionPlan
  return { ok: true, plan: current as ExecutionPlan };
}
