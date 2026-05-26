import type {
  CompilerContext,
  CompilerStage,
  DashboardWidgetIntent,
  NormalizedInsertChartAction,
  NormalizedSemanticAction,
  SemanticDiagnostic,
  StageOutcome,
} from "../types.js";

function diagnostic(
  code: string,
  message: string,
  stage = "layout-planning",
): SemanticDiagnostic {
  return { code, message, severity: "error", stage };
}

const GRID_COLUMNS = 12;

function findFreeSlot(
  occupied: Set<string>,
  w: number,
  h: number,
  startY = 0,
): { x: number; y: number } {
  for (let y = startY; ; y++) {
    for (let x = 0; x <= GRID_COLUMNS - w; x++) {
      let free = true;
      for (let dx = 0; dx < w && free; dx++) {
        for (let dy = 0; dy < h && free; dy++) {
          if (occupied.has(`${x + dx},${y + dy}`)) {
            free = false;
          }
        }
      }
      if (free) {
        return { x, y };
      }
    }
  }
}

function isSlotFree(
  occupied: Set<string>,
  x: number,
  y: number,
  w: number,
  h: number,
): boolean {
  for (let dx = 0; dx < w; dx++) {
    for (let dy = 0; dy < h; dy++) {
      if (occupied.has(`${x + dx},${y + dy}`)) {
        return false;
      }
    }
  }
  return true;
}

function resolveCollisions(
  widgets: DashboardWidgetIntent[],
): DashboardWidgetIntent[] {
  const resolved: DashboardWidgetIntent[] = [];
  const occupied = new Set<string>();

  for (const widget of widgets) {
    const w = widget.w ?? 4;
    const h = widget.h ?? 3;
    const prefX = widget.x ?? 0;
    const prefY = widget.y ?? 0;

    let slot: { x: number; y: number };
    if (isSlotFree(occupied, prefX, prefY, w, h)) {
      slot = { x: prefX, y: prefY };
    } else {
      slot = findFreeSlot(occupied, w, h, prefY);
    }

    resolved.push({ ...widget, x: slot.x, y: slot.y, w, h });
    for (let dx = 0; dx < w; dx++) {
      for (let dy = 0; dy < h; dy++) {
        occupied.add(`${slot.x + dx},${slot.y + dy}`);
      }
    }
  }

  return resolved;
}

function computeAutoLayout(
  pageId: string,
  strategy: string,
  _context: CompilerContext,
): NormalizedSemanticAction {
  return {
    type: "auto-layout",
    pageId,
    strategy: strategy as "compact" | "balanced" | "presentation",
  };
}

function planInsertChart(
  action: NormalizedInsertChartAction,
  _context: CompilerContext,
): NormalizedInsertChartAction {
  return action;
}

export const layoutPlanningStage: CompilerStage<
  NormalizedSemanticAction,
  NormalizedSemanticAction
> = {
  name: "layout-planning",

  run(
    action: NormalizedSemanticAction,
    context: CompilerContext,
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
        const resolved = resolveCollisions(action.widgets);
        return {
          ok: true,
          output: { ...action, widgets: resolved },
        };
      }

      case "insert-chart": {
        const planned = planInsertChart(action, context);
        return { ok: true, output: planned };
      }

      case "auto-layout": {
        const expanded = computeAutoLayout(
          action.pageId,
          action.strategy,
          context,
        );
        return { ok: true, output: expanded };
      }

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
