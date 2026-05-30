import { produce } from "immer";
import { z } from "zod/v4";
import type { MutableSceneNode, SceneGraph } from "../../types.js";
import { expectNode } from "../expect-node.js";
import type {
  InverseComputer,
  RuntimeContext,
  RuntimeHandler,
} from "../handler-registry.js";
import { stripDangerousKeys } from "../strip-dangerous-keys.js";

export const UpdateRuntimeActionSchema = z.object({
  type: z.literal("update-runtime"),
  nodeId: z.string(),
  runtime: z.object({}).passthrough(),
});
export type UpdateRuntimeAction = z.infer<typeof UpdateRuntimeActionSchema>;

const updateRuntimeHandler: RuntimeHandler<UpdateRuntimeAction> = (
  scene,
  action,
  _ctx,
) => {
  const node = expectNode(scene, action.nodeId, "update-runtime");

  return produce(scene, (draft) => {
    (draft.nodes[action.nodeId] as MutableSceneNode).runtime = {
      ...node.runtime,
      ...stripDangerousKeys(action.runtime),
    };
    draft.version += 1;
  });
};

const updateRuntimeValidate = (
  scene: SceneGraph,
  action: UpdateRuntimeAction,
  _ctx: RuntimeContext,
) => {
  if (!scene?.nodes) {
    return {
      ok: false,
      error: {
        code: "scene.invalid-scene",
        message: "Scene is null or missing nodes for action: update-runtime",
      },
    };
  }
  if (!scene.nodes[action.nodeId]) {
    return {
      ok: false,
      error: {
        code: "scene.node-not-found",
        message: `Node not found for action: update-runtime`,
      },
    };
  }
  return { ok: true };
};

const updateRuntimeInverse: InverseComputer<UpdateRuntimeAction> = (
  sceneBefore,
  action,
  _context,
) => {
  const node = sceneBefore.nodes[action.nodeId];
  if (!node) return undefined;

  return {
    type: "update-runtime",
    nodeId: action.nodeId,
    runtime: { ...(node.runtime ?? {}) },
  };
};

export const updateRuntimeEntry = {
  handler: updateRuntimeHandler,
  inverse: updateRuntimeInverse,
  validate: updateRuntimeValidate,
  meta: { undoable: true, mergeable: false, devtoolsLabel: "Update Runtime" },
};
