import type { UpdateSelectionAction } from "../actions.js";
import { HandlerError } from "../../engine/error.js";
import type { RuntimeHandler } from "../handler.js";
import type { InverseComputer } from "../handler-registry.js";

export const updateSelectionHandler: RuntimeHandler<UpdateSelectionAction> = (
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

  return {
    ...scene,
    selection: { nodeIds: [...action.nodeIds] },
  };
};

export const updateSelectionInverse: InverseComputer<UpdateSelectionAction> = (
  sceneBefore,
  _action,
  _context,
) => {
  return {
    type: "update-selection",
    nodeIds: sceneBefore.selection?.nodeIds ?? [],
  };
};
