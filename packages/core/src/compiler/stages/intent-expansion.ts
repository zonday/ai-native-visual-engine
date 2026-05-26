import { unsupportedAction } from "../diagnostics.js";
import type {
  CompilerContext,
  CompilerStage,
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

export const intentExpansionStage: CompilerStage<
  NormalizedSemanticAction,
  NormalizedSemanticAction
> = {
  name: "intent-expansion",

  run(
    action: NormalizedSemanticAction,
    _context: CompilerContext,
  ): StageOutcome<NormalizedSemanticAction> {
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
            unsupportedAction("intent-expansion", unsupported.type),
          ],
        };
      }
    }
  },
};
