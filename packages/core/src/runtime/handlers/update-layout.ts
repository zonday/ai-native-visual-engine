import type { SceneGraph } from "../../types.js";
import type { UpdateLayoutAction } from "../actions.js";
import { RuntimeHandlerError } from "../error.js";
import type { RuntimeHandler } from "../handler.js";
import type { InverseComputer } from "../inverse-registry.js";

export const updateLayoutHandler: RuntimeHandler<UpdateLayoutAction> = (
  scene,
  action,
  _ctx,
) => {
  const node = scene.nodes[action.nodeId];
  if (!node) {
    throw new RuntimeHandlerError(
      "scene.node-not-found",
      `Node "${action.nodeId}" not found`,
      "update-layout",
      action.nodeId,
    );
  }

  const updatedNode = {
    ...node,
    layout: { ...(node.layout ?? {}), ...action.layout },
  };

  return {
    ...scene,
    nodes: { ...scene.nodes, [action.nodeId]: updatedNode },
    version: scene.version + 1,
  };
};

export const updateLayoutInverse: InverseComputer<UpdateLayoutAction> = (
  sceneBefore,
  action,
  _context,
) => {
  const node = sceneBefore.nodes[action.nodeId];
  if (!node) return undefined;

  return {
    type: "update-layout",
    nodeId: action.nodeId,
    layout: node.layout ?? {},
  };
};
