import { produce } from "immer";
import { HandlerError } from "../../engine/error.js";
import type { SceneNode } from "../../types.js";
import type { CreateNodeAction } from "../actions.js";
import type { InverseComputer, RuntimeHandler } from "../handler-registry.js";
import { stripDangerousKeys } from "../strip-dangerous-keys.js";

const createNodeHandler: RuntimeHandler<CreateNodeAction> = (
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

  const sanitizedNode = stripDangerousKeys(
    action.node as Record<string, unknown>,
  ) as typeof action.node;

  const rawIndex =
    action.index !== undefined && Number.isFinite(action.index)
      ? action.index
      : undefined;
  const index =
    rawIndex !== undefined
      ? Math.min(Math.max(0, rawIndex), (parent.children ?? []).length)
      : (parent.children ?? []).length;

  const node: SceneNode = {
    ...sanitizedNode,
    parentId: action.parentId,
  };

  return produce(scene, (draft) => {
    const parentChildren = [...((draft.nodes[action.parentId] as SceneNode).children ?? [])];
    parentChildren.splice(index, 0, node.id);
    (draft.nodes[action.parentId] as SceneNode).children = parentChildren;
    draft.nodes[node.id] = node;
    draft.version += 1;
  });
};

const createNodeInverse: InverseComputer<CreateNodeAction> = (
  _sceneBefore,
  action,
  _context,
) => {
  return {
    type: "remove-node",
    nodeId: action.node.id,
  };
};

export const createNodeEntry = {
  handler: createNodeHandler,
  inverse: createNodeInverse,
  meta: { undoable: true, mergeable: false, devtoolsLabel: "Create Node" },
};
