import { produce } from "immer";
import { z } from "zod/v4";
import type { SceneGraph } from "../../types.js";
import { expectNode } from "../expect-node.js";
import type {
  InverseComputer,
  RuntimeContext,
  RuntimeHandler,
} from "../handler-registry.js";
import { stripDangerousKeys } from "../strip-dangerous-keys.js";

export const UpdatePropsActionSchema = z.object({
  type: z.literal("update-props"),
  nodeId: z.string(),
  props: z.object({}).passthrough(),
});
export type UpdatePropsAction = z.infer<typeof UpdatePropsActionSchema>;

const updatePropsHandler: RuntimeHandler<UpdatePropsAction> = (
  scene,
  action,
  _ctx,
) => {
  const node = expectNode(scene, action.nodeId, "update-props");

  return produce(scene, (draft) => {
    (draft.nodes[action.nodeId] as any).props = {
      ...node.props,
      ...stripDangerousKeys(action.props),
    };
    draft.version += 1;
  });
};

const updatePropsValidate = (
  scene: SceneGraph,
  action: UpdatePropsAction,
  _ctx: RuntimeContext,
) => {
  if (!scene?.nodes) {
    return {
      ok: false,
      error: {
        code: "scene.invalid-scene",
        message: "Scene is null or missing nodes for action: update-props",
      },
    };
  }
  if (!scene.nodes[action.nodeId]) {
    return {
      ok: false,
      error: {
        code: "scene.node-not-found",
        message: `Node not found for action: update-props`,
      },
    };
  }
  return { ok: true };
};

const updatePropsInverse: InverseComputer<UpdatePropsAction> = (
  sceneBefore,
  action,
  _context,
) => {
  const node = sceneBefore.nodes[action.nodeId];
  if (!node) return undefined;

  return {
    type: "update-props",
    nodeId: action.nodeId,
    props: { ...(node.props ?? {}) },
  };
};

export const updatePropsEntry = {
  handler: updatePropsHandler,
  inverse: updatePropsInverse,
  validate: updatePropsValidate,
  meta: { undoable: true, mergeable: false, devtoolsLabel: "Update Props" },
};
