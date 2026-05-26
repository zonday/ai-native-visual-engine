import type { UpdateStyleAction } from "../actions.js";
import { expectNode } from "../expect-node.js";
import type { RuntimeHandler } from "../handler.js";
import type { InverseComputer } from "../handler-registry.js";

export const updateStyleHandler: RuntimeHandler<UpdateStyleAction> = (
  scene,
  action,
  _ctx,
) => {
  const node = expectNode(scene, action.nodeId, "update-style");

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
