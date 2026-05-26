import type {
  CompilerContext,
  CompilerStage,
  NormalizedSemanticAction,
  SemanticAction,
  StageOutcome,
} from "../types.js";

function diagnostic(
  code: string,
  message: string,
  stage = "normalize",
): import("../types.js").SemanticDiagnostic {
  return { code, message, severity: "error", stage };
}

export const normalizeStage: CompilerStage<
  SemanticAction,
  NormalizedSemanticAction
> = {
  name: "normalize",

  run(
    action: SemanticAction,
    _context: CompilerContext,
  ): StageOutcome<NormalizedSemanticAction> {
    if (!action || typeof action !== "object") {
      return {
        ok: false,
        diagnostics: [
          diagnostic(
            "compiler.invalid-action",
            "Action must be a non-null object",
          ),
        ],
      };
    }

    switch (action.type) {
      case "create-dashboard": {
        if (!action.title) {
          return {
            ok: false,
            diagnostics: [
              diagnostic(
                "compiler.missing-title",
                "create-dashboard requires a title",
              ),
            ],
          };
        }
        return {
          ok: true,
          output: {
            type: "create-dashboard",
            title: action.title,
            layout: action.layout ?? "balanced",
            widgets: action.widgets ?? [],
          },
        };
      }

      case "insert-chart": {
        if (!action.containerId) {
          return {
            ok: false,
            diagnostics: [
              diagnostic(
                "compiler.missing-container",
                "insert-chart requires a containerId",
              ),
            ],
          };
        }
        return {
          ok: true,
          output: {
            type: "insert-chart",
            containerId: action.containerId,
            chartType: action.chartType,
            dataSource: action.dataSource,
            dimensions: action.dimensions ?? [],
            metrics: action.metrics ?? [],
          },
        };
      }

      case "auto-layout": {
        return {
          ok: true,
          output: {
            type: "auto-layout",
            pageId: action.pageId,
            strategy: action.strategy,
          },
        };
      }

      case "update-theme-intent": {
        return {
          ok: true,
          output: {
            type: "update-theme-intent",
            themeId: action.themeId,
            pageId: action.pageId,
          },
        };
      }

      default: {
        return {
          ok: false,
          diagnostics: [
            diagnostic(
              "compiler.unsupported-action",
              `Unsupported semantic action type: ${(action as { type: string }).type}`,
            ),
          ],
        };
      }
    }
  },
};
