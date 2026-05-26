import { createDiagnosticFactory } from "../diagnostics.js";
import type {
  CompilerContext,
  CompilerStage,
  NormalizedSemanticAction,
  SemanticAction,
  StageOutcome,
} from "../types.js";

const diag = createDiagnosticFactory("normalize");

export const normalizeStage: CompilerStage<
  SemanticAction,
  NormalizedSemanticAction
> = {
  name: "normalize",

  run(
    action: SemanticAction,
    _context: CompilerContext,
  ): StageOutcome<NormalizedSemanticAction> {
    switch (action.type) {
      case "create-dashboard": {
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
        if (!action.themeId && !action.pageId) {
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
            themeId: action.themeId,
            pageId: action.pageId,
          },
        };
      }

      default: {
        return {
          ok: false,
          diagnostics: [
            diag(
              "compiler.unsupported-action",
              `Unsupported semantic action type: ${(action as { type: string }).type}`,
            ),
          ],
        };
      }
    }
  },
};
