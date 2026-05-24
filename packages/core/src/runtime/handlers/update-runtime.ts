import type { SceneGraph } from "../../types.js";
import type { UpdateRuntimeAction } from "../actions.js";
import { RuntimeHandlerError } from "../error.js";
import type { RuntimeHandler } from "../handler.js";
import type { InverseComputer } from "../inverse-registry.js";

export const updateRuntimeHandler: RuntimeHandler<UpdateRuntimeAction> = (
  scene,
  action,
  _ctx,
) => {
  const node = scene.nodes[action.nodeId];
  if (!node) {
    throw new RuntimeHandlerError(
      "scene.node-not-found",
      `Node "${action.nodeId}" not found`,
      "update-runtime",
      action.nodeId,
    );
  }

  const updatedNode = {
    ...node,
    runtime: { ...(node.runtime ?? {}), ...action.runtime },
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

  const previousRuntime: Record<string, unknown> = {};
  for (const key of Object.keys(action.runtime)) {
    if (node.runtime && key in node.runtime) {
      previousRuntime[key] = node.runtime[key];
    }
  }

  return {
    type: "update-runtime",
    nodeId: action.nodeId,
    runtime: previousRuntime,
  };
};
