import type { Constraint } from "./constraint-types.js";

export function createWidgetSizeConstraint(): Constraint {
  return {
    id: "layout.widget-size",
    type: "layout",
    message: "Widgets must have positive width and height",
    severity: "error",
    evaluate(input) {
      if (!input.action) return { pass: true };
      if (
        input.action.type !== "update-layout" &&
        input.action.type !== "create-node"
      )
        return { pass: true };

      let layout: Record<string, unknown> | undefined;
      if (input.action.type === "update-layout") {
        layout = input.action.layout;
      } else if (input.action.type === "create-node") {
        layout = input.action.node.layout as
          | Record<string, unknown>
          | undefined;
      }
      if (!layout) return { pass: true };

      const w = layout.w as number | undefined;
      const h = layout.h as number | undefined;
      if ((w !== undefined && w <= 0) || (h !== undefined && h <= 0)) {
        const nodeId =
          "nodeId" in input.action ? input.action.nodeId : undefined;
        return {
          pass: false,
          code: "layout.widget-size",
          message: `Node "${nodeId ?? "?"}" must have positive dimensions (w=${w}, h=${h})`,
        };
      }
      return { pass: true };
    },
  };
}

export function createGridColumnConstraint(): Constraint {
  return {
    id: "layout.grid-column",
    type: "layout",
    message: "Grid items must not exceed column bounds",
    severity: "error",
    evaluate(input) {
      if (!input.action || input.action.type !== "update-layout")
        return { pass: true };
      if (!input.node) return { pass: true };

      const parent = input.scene.nodes[input.node.parentId ?? ""];
      if (!parent || parent.type !== "grid") return { pass: true };

      const parentLayout = parent.layout as { columns?: number } | undefined;
      const columns = parentLayout?.columns ?? 12;
      const layout = input.action.layout;
      if (!layout) return { pass: true };

      const x = layout.x as number | undefined;
      const w = layout.w as number | undefined;
      if (x !== undefined && w !== undefined && x + w > columns) {
        return {
          pass: false,
          code: "layout.grid-column",
          message: `Grid item exceeds column bounds (x=${x}, w=${w}, columns=${columns})`,
        };
      }
      return { pass: true };
    },
  };
}

export const DEFAULT_LAYOUT_CONSTRAINTS: Constraint[] = [
  createWidgetSizeConstraint(),
  createGridColumnConstraint(),
];
