import { produce } from "immer";
import type { UpdateRuntimeAction } from "../actions.js";
import { expectNode } from "../expect-node.js";
import type { InverseComputer, RuntimeHandler } from "../handler-registry.js";
import { stripDangerousKeys } from "../strip-dangerous-keys.js";

const updateRuntimeHandler: RuntimeHandler<UpdateRuntimeAction> = (
  scene,
  action,
  _ctx,
) => {
  const node = expectNode(scene, action.nodeId, "update-runtime");

  return produce(scene, (draft) => {
    draft.nodes[action.nodeId]!.runtime = {
      ...node.runtime,
      ...stripDangerousKeys(action.runtime),
    };
    draft.version += 1;
  });
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
  meta: { undoable: true, mergeable: false, devtoolsLabel: "Update Runtime" },
};
