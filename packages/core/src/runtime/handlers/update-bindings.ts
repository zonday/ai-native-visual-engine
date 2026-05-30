import { produce } from "immer";
import { z } from "zod/v4";
import type { MutableSceneNode, SceneGraph } from "../../types.js";
import { expectNode } from "../expect-node.js";
import type {
  InverseComputer,
  RuntimeContext,
  RuntimeHandler,
} from "../handler-registry.js";

export const UpdateBindingsActionSchema = z.object({
  type: z.literal("update-bindings"),
  nodeId: z.string(),
  bindings: z.array(
    z.object({
      key: z.string(),
      source: z.string(),
      path: z.string().optional(),
      transform: z.string().optional(),
    }),
  ),
});
export type UpdateBindingsAction = z.infer<typeof UpdateBindingsActionSchema>;

const updateBindingsHandler: RuntimeHandler<UpdateBindingsAction> = (
  scene,
  action,
  _ctx,
) => {
  expectNode(scene, action.nodeId, "update-bindings");

  return produce(scene, (draft) => {
    (draft.nodes[action.nodeId] as MutableSceneNode).bindings = [
      ...action.bindings,
    ];
    draft.version += 1;
  });
};

const updateBindingsValidate = (
  scene: SceneGraph,
  action: UpdateBindingsAction,
  _ctx: RuntimeContext,
) => {
  if (!scene?.nodes) {
    return {
      ok: false,
      error: {
        code: "scene.invalid-scene",
        message: "Scene is null or missing nodes for action: update-bindings",
      },
    };
  }
  if (!scene.nodes[action.nodeId]) {
    return {
      ok: false,
      error: {
        code: "scene.node-not-found",
        message: `Node not found for action: update-bindings`,
      },
    };
  }
  return { ok: true };
};

const updateBindingsInverse: InverseComputer<UpdateBindingsAction> = (
  sceneBefore,
  action,
  _context,
) => {
  const node = sceneBefore.nodes[action.nodeId];
  if (!node) return undefined;

  return {
    type: "update-bindings",
    nodeId: action.nodeId,
    bindings: node.bindings ?? [],
  };
};

export const updateBindingsEntry = {
  handler: updateBindingsHandler,
  inverse: updateBindingsInverse,
  validate: updateBindingsValidate,
  meta: { undoable: true, mergeable: false, devtoolsLabel: "Update Bindings" },
};
