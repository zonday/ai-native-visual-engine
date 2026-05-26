import type {
  CompilerContext,
  CompilerStage,
  NormalizedSemanticAction,
  SemanticAction,
  SemanticDiagnostic,
  StageOutcome,
} from "../types.js";

function diagnostic(
  code: string,
  message: string,
  stage = "normalize",
): SemanticDiagnostic {
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
        if (action.widgets !== undefined && !Array.isArray(action.widgets)) {
          return {
            ok: false,
            diagnostics: [
              diagnostic(
                "compiler.invalid-widgets",
                "create-dashboard widgets must be an array",
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
        if (!action.chartType) {
          return {
            ok: false,
            diagnostics: [
              diagnostic(
                "compiler.missing-chart-type",
                "insert-chart requires a chartType",
              ),
            ],
          };
        }
        if (
          action.dimensions !== undefined &&
          !Array.isArray(action.dimensions)
        ) {
          return {
            ok: false,
            diagnostics: [
              diagnostic(
                "compiler.invalid-dimensions",
                "insert-chart dimensions must be an array",
              ),
            ],
          };
        }
        if (action.metrics !== undefined && !Array.isArray(action.metrics)) {
          return {
            ok: false,
            diagnostics: [
              diagnostic(
                "compiler.invalid-metrics",
                "insert-chart metrics must be an array",
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
        if (!action.pageId) {
          return {
            ok: false,
            diagnostics: [
              diagnostic(
                "compiler.missing-page-id",
                "auto-layout requires a pageId",
              ),
            ],
          };
        }
        if (!action.strategy) {
          return {
            ok: false,
            diagnostics: [
              diagnostic(
                "compiler.missing-strategy",
                "auto-layout requires a strategy",
              ),
            ],
          };
        }
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
        if (!action.themeId && !action.pageId) {
          return {
            ok: false,
            diagnostics: [
              diagnostic(
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
