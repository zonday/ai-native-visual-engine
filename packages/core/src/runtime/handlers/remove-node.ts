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
import type { RuntimeAction } from "../register-handlers.js";

export const RemoveNodeActionSchema = z.object({
  type: z.literal("remove-node"),
  nodeId: z.string(),
});
export type RemoveNodeAction = z.infer<typeof RemoveNodeActionSchema>;

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
      (draft.nodes[node.parentId] as any).children = (
        parent.children ?? []
      ).filter((id) => id !== action.nodeId);
    }

    draft.version += 1;
  });
};

const removeNodeValidate = (
  scene: SceneGraph,
  action: RemoveNodeAction,
  _ctx: RuntimeContext,
) => {
  if (!scene?.nodes) {
    return {
      ok: false,
      error: {
        code: "scene.invalid-scene",
        message: "Scene is null or missing nodes for action: remove-node",
      },
    };
  }
  if (!scene.nodes[action.nodeId]) {
    return {
      ok: false,
      error: {
        code: "scene.node-not-found",
        message: `Node not found for action: remove-node`,
      },
    };
  }
  if (action.nodeId === scene.rootId) {
    return {
      ok: false,
      error: {
        code: "scene.root-mutation",
        message: "Cannot remove the root node",
      },
    };
  }
  return { ok: true };
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
  validate: removeNodeValidate,
  meta: { undoable: true, mergeable: false, devtoolsLabel: "Remove Node" },
};
