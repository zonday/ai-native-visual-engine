import { HandlerError } from "../../engine/error.js";
import type { SceneNode } from "../../types.js";
import type { CreateNodeAction } from "../actions.js";
import type { RuntimeHandler } from "../handler.js";
import type { InverseComputer } from "../handler-registry.js";

export const createNodeHandler: RuntimeHandler<CreateNodeAction> = (
  scene,
  action,
  _ctx,
) => {
  const parent = scene.nodes[action.parentId];
  if (!parent) {
    throw new HandlerError(
      "scene.invalid-parent",
      `Parent node "${action.parentId}" not found`,
      "create-node",
      { nodeId: action.parentId },
    );
  }

  if (scene.nodes[action.node.id]) {
    throw new HandlerError(
      "scene.duplicate-node-id",
      `Node "${action.node.id}" already exists`,
      "create-node",
      { nodeId: action.node.id },
    );
  }

  const index =
    action.index !== undefined
      ? Math.min(Math.max(0, action.index), (parent.children ?? []).length)
      : (parent.children ?? []).length;

  const node: SceneNode = {
    ...action.node,
    parentId: action.parentId,
  };

  const parentChildren = [...(parent.children ?? [])];
  parentChildren.splice(index, 0, node.id);

  const nodes = {
    ...scene.nodes,
    [action.parentId]: { ...parent, children: parentChildren },
    [node.id]: node,
  };

  return { ...scene, nodes, version: scene.version + 1 };
};

export const createNodeInverse: InverseComputer<CreateNodeAction> = (
  _sceneBefore,
  action,
  _context,
) => {
  return {
    type: "remove-node",
    nodeId: action.node.id,
  };
};
