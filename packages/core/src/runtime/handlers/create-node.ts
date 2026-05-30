import { produce } from "immer";
import { z } from "zod/v4";
import { HandlerError } from "../../engine/error.js";
import type { SceneGraph, SceneNode } from "../../types.js";
import { SceneNodeSchema } from "../../types.js";
import type { CreateNodeAction } from "../actions.js";
import type {
  InverseComputer,
  RuntimeContext,
  RuntimeHandler,
} from "../handler-registry.js";
import { stripDangerousKeys } from "../strip-dangerous-keys.js";

export const CreateNodeActionSchema = z.object({
  type: z.literal("create-node"),
  node: SceneNodeSchema,
  parentId: z.string(),
  index: z.number().optional(),
});

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
    const parentChildren = [
      ...((draft.nodes[action.parentId] as SceneNode).children ?? []),
    ];
    parentChildren.splice(index, 0, node.id);
    (draft.nodes[action.parentId] as any).children = parentChildren;
    draft.nodes[node.id] = node;
    draft.version += 1;
  });
};

const createNodeValidate = (
  scene: SceneGraph,
  action: CreateNodeAction,
  _ctx: RuntimeContext,
) => {
  if (!scene.nodes[action.parentId]) {
    return {
      ok: false,
      error: {
        code: "scene.invalid-parent",
        message: `Parent node "${action.parentId}" not found`,
      },
    };
  }
  if (scene.nodes[action.node.id]) {
    return {
      ok: false,
      error: {
        code: "scene.duplicate-node-id",
        message: `Node "${action.node.id}" already exists`,
      },
    };
  }
  return { ok: true };
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
  validate: createNodeValidate,
  meta: { undoable: true, mergeable: false, devtoolsLabel: "Create Node" },
};
