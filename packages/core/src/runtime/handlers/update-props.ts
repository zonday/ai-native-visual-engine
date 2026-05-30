import { produce } from "immer";
import type { UpdatePropsAction } from "../actions.js";
import { expectNode } from "../expect-node.js";
import type { InverseComputer, RuntimeHandler } from "../handler-registry.js";
import { stripDangerousKeys } from "../strip-dangerous-keys.js";

const updatePropsHandler: RuntimeHandler<UpdatePropsAction> = (
  scene,
  action,
  _ctx,
) => {
  const node = expectNode(scene, action.nodeId, "update-props");

  return produce(scene, (draft) => {
    draft.nodes[action.nodeId]!.props = {
      ...node.props,
      ...stripDangerousKeys(action.props),
    };
    draft.version += 1;
  });
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
  meta: { undoable: true, mergeable: false, devtoolsLabel: "Update Props" },
};
