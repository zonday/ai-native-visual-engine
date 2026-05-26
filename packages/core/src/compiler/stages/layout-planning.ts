import { unsupportedAction } from "../diagnostics.js";
import type {
  CompilerContext,
  CompilerStage,
  DashboardWidgetIntent,
  LayoutStrategy,
  NormalizedSemanticAction,
  SemanticDiagnostic,
  StageOutcome,
} from "../types.js";

const GRID_COLUMNS = 12;
const MAX_GRID_ROWS = 1000;

function findFreeSlot(
  occupied: Set<string>,
  w: number,
  h: number,
  startY = 0,
): { x: number; y: number } | null {
  for (let y = startY; y < MAX_GRID_ROWS; y++) {
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
  return null;
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

function resolveCollisions(widgets: DashboardWidgetIntent[]): {
  resolved: DashboardWidgetIntent[];
  diagnostics: SemanticDiagnostic[];
} {
  const resolved: DashboardWidgetIntent[] = [];
  const diagnostics: SemanticDiagnostic[] = [];
  const occupied = new Set<string>();

  for (const widget of widgets) {
    const w = widget.w ?? 4;
    const h = widget.h ?? 3;
    const prefX = widget.x ?? 0;
    const prefY = widget.y ?? 0;

    let slot: { x: number; y: number } | null = null;
    if (isSlotFree(occupied, prefX, prefY, w, h)) {
      slot = { x: prefX, y: prefY };
    } else {
      slot = findFreeSlot(occupied, w, h, prefY);
      if (!slot) {
        diagnostics.push({
          code: "compiler.grid-overflow",
          message: `Cannot place widget ${widget.type}: grid is full (${MAX_GRID_ROWS} rows)`,
          severity: "error",
          stage: "layout-planning",
        });
        break;
      }
    }

    resolved.push({ ...widget, x: slot.x, y: slot.y, w, h });
    for (let dx = 0; dx < w; dx++) {
      for (let dy = 0; dy < h; dy++) {
        occupied.add(`${slot.x + dx},${slot.y + dy}`);
      }
    }
  }

  return { resolved, diagnostics };
}

function computeAutoLayout(
  pageId: string,
  strategy: LayoutStrategy,
  _context: CompilerContext,
): NormalizedSemanticAction {
  return { type: "auto-layout", pageId, strategy };
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
    switch (action.type) {
      case "create-dashboard": {
        const { resolved, diagnostics } = resolveCollisions(action.widgets);
        if (diagnostics.length > 0) {
          return { ok: false, diagnostics };
        }
        return {
          ok: true,
          output: { ...action, widgets: resolved },
        };
      }

      case "insert-chart": {
        return { ok: true, output: action };
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
          diagnostics: [unsupportedAction("layout-planning", unsupported.type)],
        };
      }
    }
  },
};
