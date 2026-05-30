import { produce } from "immer";
import { z } from "zod/v4";
import { HandlerError } from "../../engine/error.js";
import type { SceneGraph } from "../../types.js";
import type { UpdateSelectionAction } from "../actions.js";
import type {
  InverseComputer,
  RuntimeContext,
  RuntimeHandler,
} from "../handler-registry.js";

export const UpdateSelectionActionSchema = z.object({
  type: z.literal("update-selection"),
  nodeIds: z.array(z.string()),
});

const updateSelectionHandler: RuntimeHandler<UpdateSelectionAction> = (
  scene,
  action,
  _ctx,
) => {
  const uniqueIds = new Set(action.nodeIds);
  if (uniqueIds.size !== action.nodeIds.length) {
    throw new HandlerError(
      "scene.duplicate-selection",
      "Selection nodeIds must not contain duplicates",
      "update-selection",
    );
  }

  for (const nodeId of action.nodeIds) {
    if (!scene.nodes[nodeId]) {
      throw new HandlerError(
        "scene.node-not-found",
        `Node "${nodeId}" not found in scene`,
        "update-selection",
        { nodeId },
      );
    }
  }

  return produce(scene, (draft) => {
    draft.selection = { nodeIds: [...action.nodeIds] };
  });
};

const updateSelectionValidate = (
  scene: SceneGraph,
  action: UpdateSelectionAction,
  _ctx: RuntimeContext,
) => {
  const uniqueIds = new Set(action.nodeIds);
  if (uniqueIds.size !== action.nodeIds.length) {
    return {
      ok: false,
      error: {
        code: "scene.duplicate-selection",
        message: "Selection nodeIds must not contain duplicates",
      },
    };
  }
  for (const nodeId of action.nodeIds) {
    if (!scene.nodes[nodeId]) {
      return {
        ok: false,
        error: {
          code: "scene.node-not-found",
          message: `Node "${nodeId}" not found in scene`,
        },
      };
    }
  }
  return { ok: true };
};

const updateSelectionInverse: InverseComputer<UpdateSelectionAction> = (
  sceneBefore,
  _action,
  _context,
) => {
  return {
    type: "update-selection",
    nodeIds: sceneBefore.selection?.nodeIds ?? [],
  };
};

export const updateSelectionEntry = {
  handler: updateSelectionHandler,
  inverse: updateSelectionInverse,
  validate: updateSelectionValidate,
  meta: { undoable: true, mergeable: false, devtoolsLabel: "Update Selection" },
};
