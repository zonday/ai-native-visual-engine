import { createStage } from "../diagnostics.js";
import type {
  CompilerContext,
  DashboardWidgetIntent,
  LayoutStrategy,
  NormalizedSemanticAction,
  StageOutcome,
} from "../types.js";

const GRID_COLUMNS = 12;
const MIN_WIDGET_WIDTH = 4;
const BALANCED_GAP = 1;
const PRESENTATION_GAP = 2;

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
  if (widgets.length === 0) return [];
  const cols = Math.min(widgets.length, GRID_COLUMNS);
  const colWidth = Math.floor(GRID_COLUMNS / cols);
  const colHeights = new Array<number>(cols).fill(0);
  const positioned: DashboardWidgetIntent[] = [];

  for (const widget of widgets) {
    const w = Math.min(widget.w ?? MIN_WIDGET_WIDTH, GRID_COLUMNS);
    const h = widget.h ?? 3;
    const colIdx = colHeights.indexOf(Math.min(...colHeights));
    if (colIdx === -1) continue;
    const x = colIdx * colWidth;
    const y = colHeights[colIdx] ?? 0;

    positioned.push({ ...widget, x, y, w, h });
    colHeights[colIdx] = (colHeights[colIdx] ?? 0) + h + BALANCED_GAP;
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
    cursorY += h + PRESENTATION_GAP;
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

export const intentExpansionStage = createStage<
  NormalizedSemanticAction,
  NormalizedSemanticAction
>("intent-expansion", {
  "create-dashboard": (
    action,
    _context: CompilerContext,
  ): StageOutcome<NormalizedSemanticAction> => {
    const a = action as Extract<
      NormalizedSemanticAction,
      { type: "create-dashboard" }
    >;
    const positioned = computeWidgetLayout(a.widgets, a.layout);
    return {
      ok: true,
      output: { ...a, widgets: positioned },
    };
  },

  "insert-chart": (
    action,
    _context: CompilerContext,
  ): StageOutcome<NormalizedSemanticAction> => ({
    ok: true,
    output: action,
  }),

  "auto-layout": (
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
