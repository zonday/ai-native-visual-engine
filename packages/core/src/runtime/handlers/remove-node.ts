import { produce } from "immer";
import { HandlerError } from "../../engine/error.js";
import type { SceneNode } from "../../types.js";
import type { RemoveNodeAction, RuntimeAction } from "../actions.js";
import { expectNode } from "../expect-node.js";
import type { InverseComputer, RuntimeHandler } from "../handler-registry.js";

const MAX_DEPTH = 1000;

function collectDescendants(
  nodeId: string,
  nodes: Record<string, SceneNode>,
  depth: number = 0,
): string[] {
  if (depth > MAX_DEPTH) return [nodeId];
  const result: string[] = [nodeId];
  const node = nodes[nodeId];
  if (node?.children) {
    for (const childId of node.children) {
      const childDescendants = collectDescendants(childId, nodes, depth + 1);
      for (let i = 0; i < childDescendants.length; i++) {
        const descendant = childDescendants[i];
        if (descendant !== undefined) result.push(descendant);
      }
    }
  }
  return result;
}

const removeNodeHandler: RuntimeHandler<RemoveNodeAction> = (
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

  return produce(scene, (draft) => {
    for (const id of descendants) {
      delete draft.nodes[id];
    }

    const parent = node.parentId ? draft.nodes[node.parentId] : undefined;
    if (parent && node.parentId) {
      draft.nodes[node.parentId]!.children = (parent.children ?? []).filter(
        (id) => id !== action.nodeId,
      );
    }

    draft.version += 1;
  });
};

const removeNodeInverse: InverseComputer<RemoveNodeAction> = (
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

export const removeNodeEntry = {
  handler: removeNodeHandler,
  inverse: removeNodeInverse,
  meta: { undoable: true, mergeable: false, devtoolsLabel: "Remove Node" },
};
