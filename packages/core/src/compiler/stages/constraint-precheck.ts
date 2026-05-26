import { diagnostic } from "../diagnostics.js";
import type {
  CompilerContext,
  CompilerStage,
  NormalizedSemanticAction,
  SemanticDiagnostic,
  StageOutcome,
} from "../types.js";

type SceneNode = {
  id: string;
  type: string;
  parentId?: string;
  children?: string[];
};

function collectAllNodeIds(context: CompilerContext): Set<string> {
  const ids = new Set<string>();
  const scene = context.scene as
    | { nodes?: Record<string, SceneNode> }
    | undefined;
  if (scene?.nodes) {
    for (const id of Object.keys(scene.nodes)) {
      ids.add(id);
    }
  }
  return ids;
}

export const constraintPrecheckStage: CompilerStage<
  NormalizedSemanticAction,
  NormalizedSemanticAction
> = {
  name: "constraint-precheck",

  run(
    action: NormalizedSemanticAction,
    context: CompilerContext,
  ): StageOutcome<NormalizedSemanticAction> {
    const diagnostics: SemanticDiagnostic[] = [];

    switch (action.type) {
      case "insert-chart": {
        if (context.scene) {
          const nodeIds = collectAllNodeIds(context);
          if (!nodeIds.has(action.containerId)) {
            diagnostics.push(
              diagnostic(
                "compiler.container-not-found",
                `Container "${action.containerId}" not found in scene`,
                "constraint-precheck",
              ),
            );
          }
        }
        break;
      }

      case "auto-layout": {
        if (context.scene) {
          const nodeIds = collectAllNodeIds(context);
          if (!nodeIds.has(action.pageId)) {
            diagnostics.push(
              diagnostic(
                "compiler.page-not-found",
                `Page "${action.pageId}" not found in document`,
                "constraint-precheck",
              ),
            );
          }
        }
        break;
      }

      case "create-dashboard":
      case "update-theme-intent": {
        break;
      }

      default: {
        const unsupported = action as { type: string };
        diagnostics.push(
          diagnostic(
            "compiler.unsupported-action",
            `Unsupported action type: ${unsupported.type}`,
            "constraint-precheck",
          ),
        );
      }
    }

    if (diagnostics.length > 0) {
      return { ok: false, diagnostics };
    }

    return { ok: true, output: action };
  },
};
