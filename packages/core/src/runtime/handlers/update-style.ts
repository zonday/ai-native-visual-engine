import type { SceneGraph } from "../../types.js";
import type { UpdateStyleAction } from "../actions.js";
import { RuntimeHandlerError } from "../error.js";
import type { RuntimeHandler } from "../handler.js";
import type { InverseComputer } from "../inverse-registry.js";

export const updateStyleHandler: RuntimeHandler<UpdateStyleAction> = (
  scene,
  action,
  _ctx,
) => {
  const node = scene.nodes[action.nodeId];
  if (!node) {
    throw new RuntimeHandlerError(
      "scene.node-not-found",
      `Node "${action.nodeId}" not found`,
      "update-style",
      action.nodeId,
    );
  }

  const updatedNode = {
    ...node,
    style: { ...action.style },
  };

  return {
    ...scene,
    nodes: { ...scene.nodes, [action.nodeId]: updatedNode },
    version: scene.version + 1,
  };
};

export const updateStyleInverse: InverseComputer<UpdateStyleAction> = (
  sceneBefore,
  action,
  _context,
) => {
  const node = sceneBefore.nodes[action.nodeId];
  if (!node) return undefined;

  return {
    type: "update-style",
    nodeId: action.nodeId,
    style: node.style ?? {},
  };
};
