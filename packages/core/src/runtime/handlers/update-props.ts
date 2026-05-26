import type { UpdatePropsAction } from "../actions.js";
import { expectNode } from "../expect-node.js";
import type { RuntimeHandler } from "../handler.js";
import type { InverseComputer } from "../inverse-registry.js";

export const updatePropsHandler: RuntimeHandler<UpdatePropsAction> = (
  scene,
  action,
  _ctx,
) => {
  const node = expectNode(scene, action.nodeId, "update-props");

  const updatedNode = {
    ...node,
    props: { ...action.props },
  };

  return {
    ...scene,
    nodes: { ...scene.nodes, [action.nodeId]: updatedNode },
    version: scene.version + 1,
  };
};

export const updatePropsInverse: InverseComputer<UpdatePropsAction> = (
  sceneBefore,
  action,
  _context,
) => {
  const node = sceneBefore.nodes[action.nodeId];
  if (!node) return undefined;

  return {
    type: "update-props",
    nodeId: action.nodeId,
    props: { ...(node.props ?? {}) },
  };
};
