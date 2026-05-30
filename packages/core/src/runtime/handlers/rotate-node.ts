import { produce } from "immer";
import { z } from "zod/v4";
import { HandlerError } from "../../engine/error.js";
import type { SceneGraph, SceneNode } from "../../types.js";
import type { RotateNodeAction } from "../actions.js";
import { expectNode } from "../expect-node.js";
import type {
  InverseComputer,
  RuntimeContext,
  RuntimeHandler,
} from "../handler-registry.js";

export const RotateNodeActionSchema = z.object({
  type: z.literal("rotate-node"),
  nodeId: z.string(),
  rotation: z.number(),
});

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

const rotateNodeValidate = (
  scene: SceneGraph,
  action: RotateNodeAction,
  ctx: RuntimeContext,
) => {
  if (!scene?.nodes) {
    return {
      ok: false,
      error: {
        code: "scene.invalid-scene",
        message: "Scene is null or missing nodes for action: rotate-node",
      },
    };
  }
  if (!scene.nodes[action.nodeId]) {
    return {
      ok: false,
      error: {
        code: "scene.node-not-found",
        message: `Node not found for action: rotate-node`,
      },
    };
  }
  const node = scene.nodes[action.nodeId];
  const layout = node.layout as Record<string, unknown> | undefined;
  if (!layout || layout.mode !== "absolute") {
    return {
      ok: false,
      error: {
        code: "scene.invalid-layout-for-rotation",
        message: `Node "${action.nodeId}" does not use absolute layout`,
      },
    };
  }
  if (ctx.registry) {
    const caps = ctx.registry.getCapabilities(node.type);
    if (caps && caps.allowsRotation === false) {
      return {
        ok: false,
        error: {
          code: "scene.rotate-not-allowed",
          message: `Plugin for type "${node.type}" does not allow rotation`,
        },
      };
    }
  }
  if (!Number.isFinite(action.rotation)) {
    return {
      ok: false,
      error: {
        code: "scene.invalid-rotation",
        message: `Invalid rotation value: ${action.rotation}`,
      },
    };
  }
  return { ok: true };
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
  validate: rotateNodeValidate,
  meta: { undoable: true, mergeable: false, devtoolsLabel: "Rotate Node" },
};
