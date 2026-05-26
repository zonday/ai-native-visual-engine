import type { SceneNode } from "../../types.js";
import type { MoveNodeAction } from "../actions.js";
import { HandlerError } from "../../engine/error.js";
import { expectNode } from "../expect-node.js";
import type { RuntimeHandler } from "../handler.js";
import type { InverseComputer } from "../handler-registry.js";

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

export const moveNodeHandler: RuntimeHandler<MoveNodeAction> = (
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

  const nodes = { ...scene.nodes };

  const oldParentId = node.parentId;
  if (oldParentId && nodes[oldParentId]) {
    nodes[oldParentId] = {
      ...nodes[oldParentId]!,
      children: (nodes[oldParentId]!.children ?? []).filter(
        (id) => id !== action.nodeId,
      ),
    };
  }

  const updatedNewParent = nodes[action.parentId]!;
  const index =
    action.index !== undefined
      ? Math.min(
          Math.max(0, action.index),
          (updatedNewParent.children ?? []).length,
        )
      : (updatedNewParent.children ?? []).length;

  const newParentChildren = [...(updatedNewParent.children ?? [])];
  newParentChildren.splice(index, 0, action.nodeId);
  nodes[action.parentId] = { ...updatedNewParent, children: newParentChildren };
  nodes[action.nodeId] = { ...node, parentId: action.parentId };

  return { ...scene, nodes, version: scene.version + 1 };
};

export const moveNodeInverse: InverseComputer<MoveNodeAction> = (
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
