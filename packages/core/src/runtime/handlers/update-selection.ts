import { produce } from "immer";
import { HandlerError } from "../../engine/error.js";
import type { UpdateSelectionAction } from "../actions.js";
import type { InverseComputer, RuntimeHandler } from "../handler-registry.js";

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
  meta: { undoable: true, mergeable: false, devtoolsLabel: "Update Selection" },
};
