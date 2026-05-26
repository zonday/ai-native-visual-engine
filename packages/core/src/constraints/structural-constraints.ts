import type { Constraint } from "./constraint-types.js";

export function createChartInContainerConstraint(): Constraint {
  return {
    id: "structural.chart-in-container",
    type: "structural",
    message: "Chart nodes must be placed inside a valid container",
    severity: "error",
    evaluate(input) {
      if (!input.action) return { pass: true };
      if (input.action.type !== "create-node") return { pass: true };

      const node = input.action.node;
      if (node.type !== "chart") return { pass: true };

      const parent = input.scene.nodes[node.parentId ?? ""];
      if (!parent || parent.type !== "container") {
        return {
          pass: false,
          code: "structural.chart-in-container",
          message: `Chart "${node.id}" must be inside a container`,
        };
      }
      return { pass: true };
    },
  };
}

export function createGridItemParentConstraint(): Constraint {
  return {
    id: "structural.grid-item-parent",
    type: "structural",
    message: "Grid-item nodes must be children of a grid",
    severity: "error",
    evaluate(input) {
      if (!input.action) return { pass: true };
      if (input.action.type !== "create-node") return { pass: true };

      const node = input.action.node;
      if (
        node.layout &&
        typeof node.layout === "object" &&
        "mode" in node.layout &&
        node.layout.mode === "grid-item"
      ) {
        const parent = input.scene.nodes[node.parentId ?? ""];
        if (!parent || parent.type !== "grid") {
          return {
            pass: false,
            code: "structural.grid-item-parent",
            message: `Grid-item "${node.id}" must be child of a grid`,
          };
        }
      }
      return { pass: true };
    },
  };
}

export function createRootCannotBeRemovedConstraint(): Constraint {
  return {
    id: "structural.root-cannot-be-removed",
    type: "structural",
    message: "Root node cannot be removed",
    severity: "error",
    evaluate(input) {
      if (!input.action) return { pass: true };
      if (input.action.type !== "remove-node") return { pass: true };

      if (input.action.nodeId === input.scene.rootId) {
        return {
          pass: false,
          code: "structural.root-cannot-be-removed",
          message: "Cannot remove the root node",
        };
      }
      return { pass: true };
    },
  };
}

export function createUniqueNodeIdConstraint(): Constraint {
  return {
    id: "structural.unique-node-id",
    type: "structural",
    message: "Node IDs must be unique within a scene",
    severity: "error",
    evaluate(input) {
      if (!input.action) return { pass: true };
      if (input.action.type !== "create-node") return { pass: true };

      if (input.scene.nodes[input.action.node.id]) {
        return {
          pass: false,
          code: "structural.unique-node-id",
          message: `Node "${input.action.node.id}" already exists in scene`,
        };
      }
      return { pass: true };
    },
  };
}

export const DEFAULT_STRUCTURAL_CONSTRAINTS: Constraint[] = [
  createChartInContainerConstraint(),
  createGridItemParentConstraint(),
  createRootCannotBeRemovedConstraint(),
  createUniqueNodeIdConstraint(),
];
