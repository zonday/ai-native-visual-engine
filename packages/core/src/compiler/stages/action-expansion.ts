import { createEmptyScene, generateId } from "../../bootstrap.js";
import type { DocumentAction } from "../../document/actions.js";
import type { RuntimeAction } from "../../runtime/actions.js";
import { diagnostic } from "../diagnostics.js";
import type {
  CompilerContext,
  CompilerStage,
  ExecutionPlan,
  NormalizedAutoLayoutAction,
  NormalizedCreateDashboardAction,
  NormalizedInsertChartAction,
  NormalizedSemanticAction,
  NormalizedUpdateThemeIntentAction,
  StageOutcome,
} from "../types.js";

export const actionExpansionStage: CompilerStage<
  NormalizedSemanticAction,
  ExecutionPlan
> = {
  name: "action-expansion",

  run(
    action: NormalizedSemanticAction,
    context: CompilerContext,
  ): StageOutcome<ExecutionPlan> {
    switch (action.type) {
      case "create-dashboard": {
        return expandCreateDashboard(action);
      }
      case "insert-chart": {
        return expandInsertChart(action);
      }
      case "auto-layout": {
        return expandAutoLayout(action, context);
      }
      case "update-theme-intent": {
        return expandUpdateThemeIntent(action);
      }
      default: {
        return {
          ok: false,
          diagnostics: [
            diagnostic(
              "compiler.unsupported-action",
              `Cannot expand unsupported action: ${(action as { type: string }).type}`,
              "action-expansion",
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
          x: widget.x ?? 0,
          y: widget.y ?? 0,
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

function expandAutoLayout(
  action: NormalizedAutoLayoutAction,
  context: CompilerContext,
): StageOutcome<ExecutionPlan> {
  const documentActions: DocumentAction[] = [];
  const runtimeActions: RuntimeAction[] = [];

  if (context.scene) {
    const scene = context.scene as {
      nodes?: Record<
        string,
        {
          id: string;
          type: string;
          layout?: Record<string, unknown>;
          children?: string[];
        }
      >;
    };
    if (scene.nodes) {
      const root = Object.values(scene.nodes).find(
        (n) => n.id === action.pageId,
      );
      if (root?.children) {
        for (const childId of root.children) {
          runtimeActions.push({
            type: "update-layout",
            nodeId: childId,
            layout: { mode: "grid-item" },
          });
        }
      }
    }
  }

  return {
    ok: true,
    output: { documentActions, runtimeActions },
  };
}

function expandUpdateThemeIntent(
  action: NormalizedUpdateThemeIntentAction,
): StageOutcome<ExecutionPlan> {
  const documentActions: DocumentAction[] = [];

  if (action.themeId && action.pageId) {
    documentActions.push({
      type: "set-page-theme",
      pageId: action.pageId,
      themeId: action.themeId,
    });
  } else if (action.themeId) {
    documentActions.push({
      type: "set-document-theme",
      themeId: action.themeId,
    });
  } else if (action.pageId) {
    documentActions.push({
      type: "set-page-theme",
      pageId: action.pageId,
    });
  }

  return {
    ok: true,
    output: { documentActions, runtimeActions: [] },
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
