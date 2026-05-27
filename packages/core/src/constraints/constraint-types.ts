import type { RuntimeAction } from "../runtime/actions.js";
import type { SceneGraph, SceneNode, VisualDocument } from "../types.js";

export type ConstraintType = "structural" | "layout" | "semantic" | "theme";

export interface ConstraintInput {
  document?: VisualDocument;
  scene: SceneGraph;
  node?: SceneNode;
  action?: RuntimeAction;
}

export interface ConstraintResult {
  pass: boolean;
  code?: string;
  message?: string;
}

export interface Constraint {
  id: string;
  type: ConstraintType;
  message: string;
  severity: "error" | "warning";
  evaluate(input: ConstraintInput): ConstraintResult;
}
