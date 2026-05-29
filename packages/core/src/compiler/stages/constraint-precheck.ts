import { createDiagnosticFactory, createStage } from "../diagnostics.js";
import type {
  CompilerContext,
  NormalizedSemanticAction,
  SemanticDiagnostic,
  StageOutcome,
} from "../types.js";

const diag = createDiagnosticFactory("constraint-precheck");

function collectAllNodeIds(context: CompilerContext): Set<string> {
  const ids = new Set<string>();
  const scene = context.scene;
  if (
    scene &&
    typeof scene === "object" &&
    "nodes" in scene &&
    typeof scene.nodes === "object" &&
    scene.nodes !== null
  ) {
    for (const id of Object.keys(scene.nodes as Record<string, unknown>)) {
      ids.add(id);
    }
  }
  return ids;
}

export const constraintPrecheckStage = createStage<
  NormalizedSemanticAction,
  NormalizedSemanticAction
>("constraint-precheck", {
  "insert-chart": (
    action,
    context: CompilerContext,
  ): StageOutcome<NormalizedSemanticAction> => {
    const a = action as Extract<
      NormalizedSemanticAction,
      { type: "insert-chart" }
    >;
    const diagnostics: SemanticDiagnostic[] = [];
    if (context.scene) {
      const nodeIds = collectAllNodeIds(context);
      if (!nodeIds.has(a.containerId)) {
        diagnostics.push(
          diag(
            "compiler.container-not-found",
            `Container "${a.containerId}" not found in scene`,
          ),
        );
      }
    }
    if (diagnostics.length > 0) return { ok: false, diagnostics };
    return { ok: true, output: a };
  },

  "auto-layout": (
    action,
    _context: CompilerContext,
  ): StageOutcome<NormalizedSemanticAction> => {
    return { ok: true, output: action };
  },

  "create-dashboard": (
    action,
    _context: CompilerContext,
  ): StageOutcome<NormalizedSemanticAction> => ({
    ok: true,
    output: action,
  }),

  "update-theme-intent": (
    action,
    _context: CompilerContext,
  ): StageOutcome<NormalizedSemanticAction> => ({
    ok: true,
    output: action,
  }),
});
