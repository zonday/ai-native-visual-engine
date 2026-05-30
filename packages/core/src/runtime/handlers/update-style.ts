import { produce } from "immer";
import { z } from "zod/v4";
import type { SceneGraph } from "../../types.js";
import type { UpdateStyleAction } from "../actions.js";
import { expectNode } from "../expect-node.js";
import type {
  InverseComputer,
  RuntimeContext,
  RuntimeHandler,
} from "../handler-registry.js";
import { stripDangerousKeys } from "../strip-dangerous-keys.js";

export const UpdateStyleActionSchema = z.object({
  type: z.literal("update-style"),
  nodeId: z.string(),
  style: z.object({}).passthrough(),
});

const updateStyleHandler: RuntimeHandler<UpdateStyleAction> = (
  scene,
  action,
  _ctx,
) => {
  expectNode(scene, action.nodeId, "update-style");

  return produce(scene, (draft) => {
    (draft.nodes[action.nodeId]  as any).style = {
      ...stripDangerousKeys(action.style),
    };
    draft.version += 1;
  });
};

const updateStyleValidate = (
  scene: SceneGraph,
  action: UpdateStyleAction,
  _ctx: RuntimeContext,
) => {
  if (!scene?.nodes) {
    return {
      ok: false,
      error: {
        code: "scene.invalid-scene",
        message: "Scene is null or missing nodes for action: update-style",
      },
    };
  }
  if (!scene.nodes[action.nodeId]) {
    return {
      ok: false,
      error: {
        code: "scene.node-not-found",
        message: `Node not found for action: update-style`,
      },
    };
  }
  return { ok: true };
};

const updateStyleInverse: InverseComputer<UpdateStyleAction> = (
  sceneBefore,
  action,
  _context,
) => {
  const node = sceneBefore.nodes[action.nodeId];
  if (!node) return undefined;

  return {
    type: "update-style",
    nodeId: action.nodeId,
    style: node.style ?? {},
  };
};

export const updateStyleEntry = {
  handler: updateStyleHandler,
  inverse: updateStyleInverse,
  validate: updateStyleValidate,
  meta: { undoable: true, mergeable: false, devtoolsLabel: "Update Style" },
};
