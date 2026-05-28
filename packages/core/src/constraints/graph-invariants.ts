import type { SceneGraph } from "../types.js";

export interface GraphInvariantViolation {
  code: string;
  message: string;
  severity: "error" | "warning";
}

export function validateGraphInvariants(
  scene: SceneGraph,
): GraphInvariantViolation[] {
  const violations: GraphInvariantViolation[] = [];
  const nodes = scene.nodes;
  const rootId = scene.rootId;

  // 1. Root exists
  if (!nodes[rootId]) {
    violations.push({
      code: "graph.missing-root",
      message: `Root node "${rootId}" does not exist`,
      severity: "error",
    });
    return violations;
  }

  for (const [id, node] of Object.entries(nodes)) {
    // 2. Root must not have parentId
    if (id === rootId && node.parentId) {
      violations.push({
        code: "graph.root-has-parent",
        message: `Root node "${id}" has a parentId`,
        severity: "error",
      });
    }

    // 3. Every parentId must reference an existing node
    if (node.parentId && !nodes[node.parentId]) {
      violations.push({
        code: "graph.dangling-parentId",
        message: `Node "${id}" has parentId "${node.parentId}" which does not exist`,
        severity: "error",
      });
    }

    // 4. Children array entries must reference existing nodes
    if (node.children) {
      for (const childId of node.children) {
        if (!nodes[childId]) {
          violations.push({
            code: "graph.orphaned-child",
            message: `Node "${id}" has child "${childId}" which does not exist`,
            severity: "error",
          });
        }
      }
    }

    // 5. Reciprocal consistency: if X is child of Y, then Y must list X in children
    if (node.parentId && node.parentId !== rootId) {
      const parent = nodes[node.parentId];
      if (parent && !parent.children?.includes(id)) {
        violations.push({
          code: "graph.inconsistent-parent-child",
          message: `Node "${id}" has parentId "${node.parentId}" but parent does not list it in children`,
          severity: "error",
        });
      }
    }
  }

  return violations;
}
