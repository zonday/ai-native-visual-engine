import type { Binding, SceneGraph } from "../../types.js";
import type { UpdateBindingsAction } from "../actions.js";
import { RuntimeHandlerError } from "../error.js";
import type { RuntimeHandler } from "../handler.js";
import type { InverseComputer } from "../inverse-registry.js";

export const updateBindingsHandler: RuntimeHandler<UpdateBindingsAction> = (
  scene,
  action,
  _ctx,
) => {
  const node = scene.nodes[action.nodeId];
  if (!node) {
    throw new RuntimeHandlerError(
      "scene.node-not-found",
      `Node "${action.nodeId}" not found`,
      "update-bindings",
      action.nodeId,
    );
  }

  const updatedNode = {
    ...node,
    bindings: [...action.bindings],
  };

  return {
    ...scene,
    nodes: { ...scene.nodes, [action.nodeId]: updatedNode },
    version: scene.version + 1,
  };
};

export const updateBindingsInverse: InverseComputer<UpdateBindingsAction> = (
  sceneBefore,
  action,
  _context,
) => {
  const node = sceneBefore.nodes[action.nodeId];
  if (!node) return undefined;

  return {
    type: "update-bindings",
    nodeId: action.nodeId,
    bindings: node.bindings ?? [],
  };
};
