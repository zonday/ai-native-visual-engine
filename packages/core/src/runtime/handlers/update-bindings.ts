import type { UpdateBindingsAction } from "../actions.js";
import { expectNode } from "../expect-node.js";
import type { InverseComputer, RuntimeHandler } from "../handler-registry.js";

export const updateBindingsHandler: RuntimeHandler<UpdateBindingsAction> = (
  scene,
  action,
  _ctx,
) => {
  const node = expectNode(scene, action.nodeId, "update-bindings");

  const updatedNode = {
    ...node,
    bindings: [...action.bindings],
  };

  return {
    ...scene,
    nodes: { ...scene.nodes, [action.nodeId]: updatedNode },
    version: scene.version + 1,
  };
};

export const updateBindingsInverse: InverseComputer<UpdateBindingsAction> = (
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

export const updateBindingsMeta = {
  undoable: true,
  mergeable: false,
  devtoolsLabel: "Update Bindings",
} as const;
