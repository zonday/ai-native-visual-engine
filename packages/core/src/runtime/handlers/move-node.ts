import { produce } from "immer";
import { z } from "zod/v4";
import { HandlerError } from "../../engine/error.js";
import type { SceneGraph, SceneNode } from "../../types.js";
import { expectNode } from "../expect-node.js";
import type {
  InverseComputer,
  RuntimeContext,
  RuntimeHandler,
} from "../handler-registry.js";

export const MoveNodeActionSchema = z.object({
  type: z.literal("move-node"),
  nodeId: z.string(),
  parentId: z.string(),
  index: z.number().optional(),
});
export type MoveNodeAction = z.infer<typeof MoveNodeActionSchema>;

function isDescendantOf(
  nodeId: string,
  potentialAncestorId: string,
  nodes: Record<string, SceneNode>,
): boolean {
  let current: string | undefined = nodeId;
  const visited = new Set<string>();
  while (current) {
    if (current === potentialAncestorId) return true;
    if (visited.has(current)) return false;
    visited.add(current);
    const node: SceneNode | undefined = nodes[current];
    current = node?.parentId;
  }
  return false;
}

const moveNodeHandler: RuntimeHandler<MoveNodeAction> = (
  scene,
  action,
  _ctx,
) => {
  const node = expectNode(scene, action.nodeId, "move-node");

  const newParent = scene.nodes[action.parentId];
  if (!newParent) {
    throw new HandlerError(
      "scene.invalid-parent",
      `New parent "${action.parentId}" not found`,
      "move-node",
      { nodeId: action.parentId },
    );
  }

  if (action.nodeId === action.parentId) {
    throw new HandlerError(
      "scene.cycle-detected",
      "Cannot move a node into itself",
      "move-node",
      { nodeId: action.nodeId },
    );
  }

  if (isDescendantOf(action.parentId, action.nodeId, scene.nodes)) {
    throw new HandlerError(
      "scene.cycle-detected",
      `Moving "${action.nodeId}" into "${action.parentId}" would create a cycle`,
      "move-node",
      { nodeId: action.nodeId },
    );
  }

  const oldParentId = node.parentId;

  const rawIndex =
    action.index !== undefined && Number.isFinite(action.index)
      ? action.index
      : undefined;
  const index =
    rawIndex !== undefined
      ? Math.min(
          Math.max(0, rawIndex),
          (scene.nodes[action.parentId]?.children ?? []).length,
        )
      : (scene.nodes[action.parentId]?.children ?? []).length;

  return produce(scene, (draft) => {
    if (oldParentId) {
      const oldParent = draft.nodes[oldParentId];
      if (oldParent) {
        oldParent.children = (oldParent.children ?? []).filter(
          (id) => id !== action.nodeId,
        );
      }
    }

    const newParentChildren = [
      ...((draft.nodes[action.parentId] as SceneNode).children ?? []),
    ];
    newParentChildren.splice(index, 0, action.nodeId);
    (draft.nodes[action.parentId] as any).children = newParentChildren;
    (draft.nodes[action.nodeId] as any).parentId = action.parentId;
    draft.version += 1;
  });
};

const moveNodeValidate = (
  scene: SceneGraph,
  action: MoveNodeAction,
  _ctx: RuntimeContext,
) => {
  if (!scene?.nodes) {
    return {
      ok: false,
      error: {
        code: "scene.invalid-scene",
        message: "Scene is null or missing nodes for action: move-node",
      },
    };
  }
  if (!scene.nodes[action.nodeId]) {
    return {
      ok: false,
      error: {
        code: "scene.node-not-found",
        message: `Node not found for action: move-node`,
      },
    };
  }
  if (!scene.nodes[action.parentId]) {
    return {
      ok: false,
      error: {
        code: "scene.invalid-parent",
        message: `New parent "${action.parentId}" not found`,
      },
    };
  }
  if (action.nodeId === action.parentId) {
    return {
      ok: false,
      error: {
        code: "scene.cycle-detected",
        message: "Cannot move a node into itself",
      },
    };
  }
  if (isDescendantOf(action.parentId, action.nodeId, scene.nodes)) {
    return {
      ok: false,
      error: {
        code: "scene.cycle-detected",
        message: `Moving "${action.nodeId}" into "${action.parentId}" would create a cycle`,
      },
    };
  }
  return { ok: true };
};

const moveNodeInverse: InverseComputer<MoveNodeAction> = (
  sceneBefore,
  action,
  _context,
) => {
  const node = sceneBefore.nodes[action.nodeId];
  if (!node) return undefined;

  const oldParentId = node.parentId;
  const oldIndex = oldParentId
    ? (sceneBefore.nodes[oldParentId]?.children ?? []).indexOf(action.nodeId)
    : undefined;

  return {
    type: "move-node",
    nodeId: action.nodeId,
    parentId: oldParentId ?? sceneBefore.rootId,
    index: oldIndex,
  };
};

export const moveNodeEntry = {
  handler: moveNodeHandler,
  inverse: moveNodeInverse,
  validate: moveNodeValidate,
  meta: { undoable: true, mergeable: false, devtoolsLabel: "Move Node" },
};
