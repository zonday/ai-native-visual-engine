import type { SceneGraph, SceneNode } from "../../types.js";
import type { RemoveNodeAction } from "../actions.js";
import { RuntimeHandlerError } from "../error.js";
import type { RuntimeHandler } from "../handler.js";
import type { InverseComputer } from "../inverse-registry.js";

function collectDescendants(
  nodeId: string,
  nodes: Record<string, SceneNode>,
): string[] {
  const node = nodes[nodeId];
  if (!node || !node.children) return [nodeId];
  const descendants = [nodeId];
  for (const childId of node.children) {
    descendants.push(...collectDescendants(childId, nodes));
  }
  return descendants;
}

export const removeNodeHandler: RuntimeHandler<RemoveNodeAction> = (
  scene,
  action,
  _ctx,
) => {
  const node = scene.nodes[action.nodeId];
  if (!node) {
    throw new RuntimeHandlerError(
      "scene.node-not-found",
      `Node "${action.nodeId}" not found`,
      "remove-node",
      action.nodeId,
    );
  }

  if (action.nodeId === scene.rootId) {
    throw new RuntimeHandlerError(
      "scene.cannot-remove-root",
      "Cannot remove the root node",
      "remove-node",
      action.nodeId,
    );
  }

  const descendants = collectDescendants(action.nodeId, scene.nodes);
  const nodes = { ...scene.nodes };
  for (const id of descendants) {
    delete nodes[id];
  }

  const parent = node.parentId ? nodes[node.parentId] : undefined;
  if (parent && node.parentId) {
    nodes[node.parentId] = {
      ...parent,
      children: (parent.children ?? []).filter((id) => id !== action.nodeId),
    };
  }

  return { ...scene, nodes, version: scene.version + 1 };
};

export const removeNodeInverse: InverseComputer<RemoveNodeAction> = (
  sceneBefore,
  action,
  _context,
) => {
  const node = sceneBefore.nodes[action.nodeId];
  if (!node) return undefined;

  const descendants = collectDescendants(action.nodeId, sceneBefore.nodes);
  const nodesToRestore: Record<string, SceneNode> = {};
  for (const id of descendants) {
    const n = sceneBefore.nodes[id];
    if (n) nodesToRestore[id] = n;
  }

  return {
    type: "create-node",
    node: node,
    parentId: node.parentId ?? sceneBefore.rootId,
    index: node.parentId
      ? (sceneBefore.nodes[node.parentId]?.children ?? []).indexOf(
          action.nodeId,
        )
      : undefined,
  };
};
