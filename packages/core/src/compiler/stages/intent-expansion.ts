import type {
  CompilerContext,
  CompilerStage,
  DashboardWidgetIntent,
  LayoutStrategy,
  NormalizedSemanticAction,
  SemanticDiagnostic,
  StageOutcome,
} from "../types.js";

function diagnostic(
  code: string,
  message: string,
  stage = "intent-expansion",
): SemanticDiagnostic {
  return { code, message, severity: "error", stage };
}

const GRID_COLUMNS = 12;
const MIN_WIDGET_WIDTH = 4;

function computeCompactLayout(
  widgets: DashboardWidgetIntent[],
): DashboardWidgetIntent[] {
  const positioned: DashboardWidgetIntent[] = [];
  let cursorX = 0;
  let cursorY = 0;
  let rowMaxH = 0;

  for (const widget of widgets) {
    const w = Math.min(widget.w ?? MIN_WIDGET_WIDTH, GRID_COLUMNS);
    const h = widget.h ?? 3;

    if (cursorX + w > GRID_COLUMNS) {
      cursorX = 0;
      cursorY += rowMaxH;
      rowMaxH = 0;
    }

    positioned.push({ ...widget, x: cursorX, y: cursorY, w, h });
    cursorX += w;
    rowMaxH = Math.max(rowMaxH, h);
  }

  return positioned;
}

function computeBalancedLayout(
  widgets: DashboardWidgetIntent[],
): DashboardWidgetIntent[] {
  const positioned: DashboardWidgetIntent[] = [];
  let cursorY = 0;
  let row = 0;

  for (const widget of widgets) {
    const w = Math.min(widget.w ?? MIN_WIDGET_WIDTH, GRID_COLUMNS);
    const h = widget.h ?? 3;
    const cols = Math.max(1, widgets.length);
    const colSpan = Math.floor(GRID_COLUMNS / Math.min(cols, GRID_COLUMNS));

    const x = (row * colSpan) % GRID_COLUMNS;
    const y = cursorY;

    positioned.push({ ...widget, x, y, w, h });
    cursorY += h + 1;
    row++;
  }

  return positioned;
}

function computePresentationLayout(
  widgets: DashboardWidgetIntent[],
): DashboardWidgetIntent[] {
  const positioned: DashboardWidgetIntent[] = [];
  let cursorY = 0;

  for (const widget of widgets) {
    const w = Math.min(widget.w ?? 10, GRID_COLUMNS);
    const h = widget.h ?? 6;
    const x = Math.floor((GRID_COLUMNS - w) / 2);

    positioned.push({ ...widget, x, y: cursorY, w, h });
    cursorY += h + 2;
  }

  return positioned;
}

function computeWidgetLayout(
  widgets: DashboardWidgetIntent[],
  strategy: LayoutStrategy,
): DashboardWidgetIntent[] {
  switch (strategy) {
    case "compact":
      return computeCompactLayout(widgets);
    case "balanced":
      return computeBalancedLayout(widgets);
    case "presentation":
      return computePresentationLayout(widgets);
  }
}

export const intentExpansionStage: CompilerStage<
  NormalizedSemanticAction,
  NormalizedSemanticAction
> = {
  name: "intent-expansion",

  run(
    action: NormalizedSemanticAction,
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
        const positioned = computeWidgetLayout(action.widgets, action.layout);
        return {
          ok: true,
          output: {
            ...action,
            widgets: positioned,
          },
        };
      }

      case "insert-chart":
      case "auto-layout":
      case "update-theme-intent": {
        return { ok: true, output: action };
      }

      default: {
        const unsupported = action as { type: string };
        return {
          ok: false,
          diagnostics: [
            diagnostic(
              "compiler.unsupported-action",
              `Unsupported action type: ${unsupported.type}`,
            ),
          ],
        };
      }
    }
  },
};
