import type { UpdateRuntimeAction } from "../actions.js";
import { expectNode } from "../expect-node.js";
import type { RuntimeHandler } from "../handler.js";
import type { InverseComputer } from "../handler-registry.js";

export const updateRuntimeHandler: RuntimeHandler<UpdateRuntimeAction> = (
  scene,
  action,
  _ctx,
) => {
  const node = expectNode(scene, action.nodeId, "update-runtime");

  const updatedNode = {
    ...node,
    runtime: { ...action.runtime },
  };

  return {
    ...scene,
    nodes: { ...scene.nodes, [action.nodeId]: updatedNode },
    version: scene.version + 1,
  };
};

export const updateRuntimeInverse: InverseComputer<UpdateRuntimeAction> = (
  sceneBefore,
  action,
  _context,
) => {
  const node = sceneBefore.nodes[action.nodeId];
  if (!node) return undefined;

  return {
    type: "update-runtime",
    nodeId: action.nodeId,
    runtime: { ...(node.runtime ?? {}) },
  };
};
