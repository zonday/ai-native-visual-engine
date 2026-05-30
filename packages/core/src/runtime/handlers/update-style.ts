import { produce } from "immer";
import type { UpdateStyleAction } from "../actions.js";
import { expectNode } from "../expect-node.js";
import type { InverseComputer, RuntimeHandler } from "../handler-registry.js";
import { stripDangerousKeys } from "../strip-dangerous-keys.js";

const updateStyleHandler: RuntimeHandler<UpdateStyleAction> = (
  scene,
  action,
  _ctx,
) => {
  expectNode(scene, action.nodeId, "update-style");

  return produce(scene, (draft) => {
    draft.nodes[action.nodeId].style = {
      ...stripDangerousKeys(action.style),
    };
    draft.version += 1;
  });
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
  meta: { undoable: true, mergeable: false, devtoolsLabel: "Update Style" },
};
