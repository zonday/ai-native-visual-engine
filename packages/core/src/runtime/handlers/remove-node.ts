import { HandlerError } from "../../engine/error.js";
import type { SceneNode } from "../../types.js";
import type { RemoveNodeAction, RuntimeAction } from "../actions.js";
import { expectNode } from "../expect-node.js";
import type { RuntimeHandler } from "../handler.js";
import type { InverseComputer } from "../handler-registry.js";

function collectDescendants(
  nodeId: string,
  nodes: Record<string, SceneNode>,
): string[] {
  const node = nodes[nodeId];
  if (!node?.children) return [nodeId];
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
  const node = expectNode(scene, action.nodeId, "remove-node");

  if (action.nodeId === scene.rootId) {
    throw new HandlerError(
      "scene.root-mutation",
      "Cannot remove the root node",
      "remove-node",
      { nodeId: action.nodeId },
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

  const createActions: RuntimeAction[] = [];
  for (const id of descendants) {
    const n = sceneBefore.nodes[id];
    if (!n) continue;
    createActions.push({
      type: "create-node",
      node: { ...n, children: undefined },
      parentId: n.parentId ?? sceneBefore.rootId,
      index: n.parentId
        ? (sceneBefore.nodes[n.parentId]?.children ?? []).indexOf(id)
        : undefined,
    });
  }

  const first = createActions[0];
  if (createActions.length === 1 && first) {
    return first;
  }
  return { type: "batch-actions", actions: createActions };
};
