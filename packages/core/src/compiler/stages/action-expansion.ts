import { createEmptyScene, generateId } from "../../bootstrap.js";
import type { DocumentAction } from "../../document/actions.js";
import type { RuntimeAction } from "../../runtime/actions.js";
import { createStage } from "../diagnostics.js";
import type {
  CompilerContext,
  ExecutionPlan,
  NormalizedAutoLayoutAction,
  NormalizedCreateDashboardAction,
  NormalizedInsertChartAction,
  NormalizedSemanticAction,
  NormalizedUpdateThemeIntentAction,
  StageOutcome,
} from "../types.js";

export const actionExpansionStage = createStage<
  NormalizedSemanticAction,
  ExecutionPlan
>("action-expansion", {
  "create-dashboard": (
    action,
    _context: CompilerContext,
  ): StageOutcome<ExecutionPlan> => {
    return expandCreateDashboard(action as NormalizedCreateDashboardAction);
  },

  "insert-chart": (
    action,
    _context: CompilerContext,
  ): StageOutcome<ExecutionPlan> => {
    return expandInsertChart(action as NormalizedInsertChartAction);
  },

  "auto-layout": (
    action,
    context: CompilerContext,
  ): StageOutcome<ExecutionPlan> => {
    return expandAutoLayout(action as NormalizedAutoLayoutAction, context);
  },

  "update-theme-intent": (
    action,
    _context: CompilerContext,
  ): StageOutcome<ExecutionPlan> => {
    return expandUpdateThemeIntent(action as NormalizedUpdateThemeIntentAction);
  },
});

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

  if (
    context.scene &&
    typeof context.scene === "object" &&
    "nodes" in context.scene
  ) {
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
      const root = scene.nodes[action.pageId];
      if (root?.children) {
        const cols = Math.min(root.children.length, 12);
        const colWidth = Math.floor(12 / Math.max(cols, 1));
        let y = 0;
        let rowMaxH = 0;

        for (let i = 0; i < root.children.length; i++) {
          const childId = root.children[i];
          if (!childId) continue;
          const node = scene.nodes[childId];
          const w = Math.min(
            ((node?.layout as Record<string, unknown> | undefined)?.w as
              | number
              | undefined) ?? colWidth,
            12,
          );
          const h =
            ((node?.layout as Record<string, unknown> | undefined)?.h as
              | number
              | undefined) ?? 3;
          const x = (i % cols) * colWidth;

          if (i > 0 && i % cols === 0) {
            y += rowMaxH + 1;
            rowMaxH = 0;
          }
          rowMaxH = Math.max(rowMaxH, h);

          runtimeActions.push({
            type: "update-layout",
            nodeId: childId,
            layout: { mode: "grid-item", x, y, w, h },
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
