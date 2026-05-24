import type { SceneGraph } from "../../types.js";
import type { UpdatePropsAction } from "../actions.js";
import { RuntimeHandlerError } from "../error.js";
import type { RuntimeHandler } from "../handler.js";
import type { InverseComputer } from "../inverse-registry.js";

export const updatePropsHandler: RuntimeHandler<UpdatePropsAction> = (
  scene,
  action,
  _ctx,
) => {
  const node = scene.nodes[action.nodeId];
  if (!node) {
    throw new RuntimeHandlerError(
      "scene.node-not-found",
      `Node "${action.nodeId}" not found`,
      "update-props",
      action.nodeId,
    );
  }

  const updatedNode = {
    ...node,
    props: { ...(node.props ?? {}), ...action.props },
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

  const previousProps: Record<string, unknown> = {};
  for (const key of Object.keys(action.props)) {
    if (node.props && key in node.props) {
      previousProps[key] = node.props[key];
    }
  }

  return {
    type: "update-props",
    nodeId: action.nodeId,
    props: previousProps,
  };
};
