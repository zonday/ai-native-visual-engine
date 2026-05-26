import { createEmptyScene, generateId } from "../../bootstrap.js";
import type { RuntimeAction } from "../../runtime/actions.js";
import type {
  CompilerContext,
  CompilerStage,
  ExecutionPlan,
  NormalizedCreateDashboardAction,
  NormalizedInsertChartAction,
  NormalizedSemanticAction,
  StageOutcome,
} from "../types.js";

function diagnostic(
  code: string,
  message: string,
  stage = "action-expansion",
): import("../types.js").SemanticDiagnostic {
  return { code, message, severity: "error", stage };
}

export const actionExpansionStage: CompilerStage<
  NormalizedSemanticAction,
  ExecutionPlan
> = {
  name: "action-expansion",

  run(
    action: NormalizedSemanticAction,
    _context: CompilerContext,
  ): StageOutcome<ExecutionPlan> {
    switch (action.type) {
      case "create-dashboard": {
        return expandCreateDashboard(action);
      }
      case "insert-chart": {
        return expandInsertChart(action);
      }
      case "auto-layout":
      case "update-theme-intent": {
        return {
          ok: false,
          diagnostics: [
            diagnostic(
              "compiler.not-implemented",
              `Expansion for ${action.type} is not yet implemented`,
            ),
          ],
        };
      }
      default: {
        return {
          ok: false,
          diagnostics: [
            diagnostic(
              "compiler.unsupported-action",
              `Cannot expand unsupported action: ${(action as { type: string }).type}`,
            ),
          ],
        };
      }
    }
  },
};

function expandCreateDashboard(
  action: NormalizedCreateDashboardAction,
): StageOutcome<ExecutionPlan> {
  const runtimeActions: RuntimeAction[] = [];
  const rootId = generateId("root");
  const pageId = generateId("page");
  const sceneId = generateId("scene");
  const scene = createEmptyScene(rootId);

  const gridId = generateId("grid");
  runtimeActions.push({
    type: "create-node",
    node: {
      id: gridId,
      type: "grid",
      parentId: rootId,
      layout: { mode: "grid", columns: 12, rowHeight: 80, gap: 12 },
    },
    parentId: rootId,
  });

  for (const widget of action.widgets) {
    const widgetId = generateId("widget");
    runtimeActions.push({
      type: "create-node",
      node: {
        id: widgetId,
        type: widget.type,
        parentId: gridId,
        props: { title: widget.title ?? widget.type },
        layout: {
          mode: "grid-item",
          x: 0,
          y: 0,
          w: widget.w ?? 4,
          h: widget.h ?? 3,
        },
      },
      parentId: gridId,
    });
  }

  return {
    ok: true,
    output: {
      documentActions: [
        {
          type: "create-page",
          page: { id: pageId, name: action.title, sceneId },
          scene,
        },
      ],
      runtimeActions,
    },
  };
}

function expandInsertChart(
  action: NormalizedInsertChartAction,
): StageOutcome<ExecutionPlan> {
  const chartId = generateId("chart");

  return {
    ok: true,
    output: {
      documentActions: [],
      runtimeActions: [
        {
          type: "create-node",
          node: {
            id: chartId,
            type: action.chartType,
            parentId: action.containerId,
            props: {
              dataSource: action.dataSource,
              dimensions: action.dimensions,
              metrics: action.metrics,
            },
            layout: { mode: "grid-item", x: 0, y: 0, w: 6, h: 4 },
          },
          parentId: action.containerId,
        },
      ],
    },
  };
}
