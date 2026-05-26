import { createDiagnosticFactory, unsupportedAction } from "../diagnostics.js";
import type {
  CompilerContext,
  CompilerStage,
  NormalizedSemanticAction,
  SemanticDiagnostic,
  StageOutcome,
} from "../types.js";

const diag = createDiagnosticFactory("constraint-precheck");

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
              diag(
                "compiler.container-not-found",
                `Container "${action.containerId}" not found in scene`,
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
              diag(
                "compiler.page-not-found",
                `Page "${action.pageId}" not found in document`,
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
          unsupportedAction("constraint-precheck", unsupported.type),
        );
      }
    }

    if (diagnostics.length > 0) {
      return { ok: false, diagnostics };
    }

    return { ok: true, output: action };
  },
};
