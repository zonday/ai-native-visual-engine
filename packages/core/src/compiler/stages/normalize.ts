import { createDiagnosticFactory, createStage } from "../diagnostics.js";
import type {
  CompilerContext,
  NormalizedSemanticAction,
  SemanticAction,
  StageOutcome,
} from "../types.js";

const diag = createDiagnosticFactory("normalize");

export const normalizeStage = createStage<
  SemanticAction,
  NormalizedSemanticAction
>("normalize", {
  "create-dashboard": (
    action,
    _context: CompilerContext,
  ): StageOutcome<NormalizedSemanticAction> => {
    const a = action as Extract<SemanticAction, { type: "create-dashboard" }>;
    return {
      ok: true,
      output: {
        type: "create-dashboard",
        title: a.title,
        layout: a.layout ?? "balanced",
        widgets: a.widgets ?? [],
      },
    };
  },

  "insert-chart": (
    action,
    _context: CompilerContext,
  ): StageOutcome<NormalizedSemanticAction> => {
    const a = action as Extract<SemanticAction, { type: "insert-chart" }>;
    return {
      ok: true,
      output: {
        type: "insert-chart",
        containerId: a.containerId,
        chartType: a.chartType,
        dataSource: a.dataSource,
        dimensions: a.dimensions ?? [],
        metrics: a.metrics ?? [],
      },
    };
  },

  "auto-layout": (
    action,
    _context: CompilerContext,
  ): StageOutcome<NormalizedSemanticAction> => {
    const a = action as Extract<SemanticAction, { type: "auto-layout" }>;
    return {
      ok: true,
      output: {
        type: "auto-layout",
        pageId: a.pageId,
        strategy: a.strategy,
      },
    };
  },

  "update-theme-intent": (
    action,
    _context: CompilerContext,
  ): StageOutcome<NormalizedSemanticAction> => {
    const a = action as Extract<
      SemanticAction,
      { type: "update-theme-intent" }
    >;
    if (!a.themeId && !a.pageId) {
      return {
        ok: false,
        diagnostics: [
          diag(
            "compiler.missing-theme-or-page",
            "update-theme-intent requires at least one of themeId or pageId",
          ),
        ],
      };
    }
    return {
      ok: true,
      output: {
        type: "update-theme-intent",
        themeId: a.themeId,
        pageId: a.pageId,
      },
    };
  },
});
