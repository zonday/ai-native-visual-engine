import { produce } from "immer";
import { HandlerError } from "../../engine/error.js";
import type { RotateNodeAction } from "../actions.js";
import { expectNode } from "../expect-node.js";
import type { InverseComputer, RuntimeHandler } from "../handler-registry.js";

function normalizeRotation(degrees: number): number {
  const normalized = ((degrees % 360) + 360) % 360;
  return normalized;
}

const rotateNodeHandler: RuntimeHandler<RotateNodeAction> = (
  scene,
  action,
  ctx,
) => {
  const node = expectNode(scene, action.nodeId, "rotate-node");

  const layout = node.layout as Record<string, unknown> | undefined;
  if (!layout || layout.mode !== "absolute") {
    throw new HandlerError(
      "scene.invalid-layout-for-rotation",
      `Node "${action.nodeId}" does not use absolute layout`,
      "rotate-node",
      { nodeId: action.nodeId },
    );
  }

  if (ctx.registry) {
    const caps = ctx.registry.getCapabilities(node.type);
    if (caps && caps.allowsRotation === false) {
      throw new HandlerError(
        "scene.rotate-not-allowed",
        `Plugin for type "${node.type}" does not allow rotation`,
        "rotate-node",
        { nodeId: action.nodeId },
      );
    }
  }

  if (!Number.isFinite(action.rotation)) {
    throw new HandlerError(
      "scene.invalid-rotation",
      `Invalid rotation value: ${action.rotation}`,
      "rotate-node",
      { nodeId: action.nodeId },
    );
  }
  const normalized = normalizeRotation(action.rotation);

  return produce(scene, (draft) => {
    (
      (draft.nodes[action.nodeId] as SceneNode).layout as Record<
        string,
        unknown
      >
    ).rotation = normalized;
    draft.version += 1;
  });
};

const rotateNodeInverse: InverseComputer<RotateNodeAction> = (
  sceneBefore,
  action,
  _context,
) => {
  const node = sceneBefore.nodes[action.nodeId];
  if (!node) return undefined;

  const layout = node.layout as Record<string, unknown> | undefined;
  const previousRotation = layout?.rotation as number | undefined;

  return {
    type: "rotate-node",
    nodeId: action.nodeId,
    rotation: previousRotation ?? 0,
  };
};

export const rotateNodeEntry = {
  handler: rotateNodeHandler,
  inverse: rotateNodeInverse,
  meta: { undoable: true, mergeable: false, devtoolsLabel: "Rotate Node" },
};
