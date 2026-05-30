import { produce } from "immer";
import { z } from "zod/v4";
import { HandlerError } from "../../engine/error.js";
import type { SceneGraph } from "../../types.js";
import type { UpdateLayoutAction } from "../actions.js";
import { expectNode } from "../expect-node.js";
import type {
  InverseComputer,
  RuntimeContext,
  RuntimeHandler,
} from "../handler-registry.js";
import { stripDangerousKeys } from "../strip-dangerous-keys.js";

export const UpdateLayoutActionSchema = z.object({
  type: z.literal("update-layout"),
  nodeId: z.string(),
  layout: z.object({}).passthrough(),
});

function validateLayout(layout: Record<string, unknown>, nodeId: string): void {
  if ("width" in layout) {
    const w = layout.width;
    if (typeof w !== "number" || !Number.isFinite(w) || w < 0) {
      throw new HandlerError(
        "scene.invalid-geometry",
        `Invalid width "${w}" for node "${nodeId}"`,
        "update-layout",
        { nodeId },
      );
    }
  }
  if ("height" in layout) {
    const h = layout.height;
    if (typeof h !== "number" || !Number.isFinite(h) || h < 0) {
      throw new HandlerError(
        "scene.invalid-geometry",
        `Invalid height "${h}" for node "${nodeId}"`,
        "update-layout",
        { nodeId },
      );
    }
  }
  if ("x" in layout) {
    const x = layout.x;
    if (typeof x !== "number" || !Number.isFinite(x)) {
      throw new HandlerError(
        "scene.invalid-geometry",
        `Invalid x "${x}" for node "${nodeId}"`,
        "update-layout",
        { nodeId },
      );
    }
  }
  if ("y" in layout) {
    const y = layout.y;
    if (typeof y !== "number" || !Number.isFinite(y)) {
      throw new HandlerError(
        "scene.invalid-geometry",
        `Invalid y "${y}" for node "${nodeId}"`,
        "update-layout",
        { nodeId },
      );
    }
  }
}

const updateLayoutHandler: RuntimeHandler<UpdateLayoutAction> = (
  scene,
  action,
  _ctx,
) => {
  const node = expectNode(scene, action.nodeId, "update-layout");

  const merged = {
    ...(node.layout ?? {}),
    ...stripDangerousKeys(action.layout),
  };
  validateLayout(merged, action.nodeId);

  return produce(scene, (draft) => {
    (draft.nodes[action.nodeId] as any).layout = merged;
    draft.version += 1;
  });
};

function validateLayoutValue(
  layout: Record<string, unknown>,
  nodeId: string,
): {
  ok: boolean;
  error?: { code: string; message: string };
} {
  if ("width" in layout) {
    const w = layout.width;
    if (typeof w !== "number" || !Number.isFinite(w) || w < 0) {
      return {
        ok: false,
        error: {
          code: "scene.invalid-geometry",
          message: `Invalid width "${w}" for node "${nodeId}"`,
        },
      };
    }
  }
  if ("height" in layout) {
    const h = layout.height;
    if (typeof h !== "number" || !Number.isFinite(h) || h < 0) {
      return {
        ok: false,
        error: {
          code: "scene.invalid-geometry",
          message: `Invalid height "${h}" for node "${nodeId}"`,
        },
      };
    }
  }
  if ("x" in layout) {
    const x = layout.x;
    if (typeof x !== "number" || !Number.isFinite(x)) {
      return {
        ok: false,
        error: {
          code: "scene.invalid-geometry",
          message: `Invalid x "${x}" for node "${nodeId}"`,
        },
      };
    }
  }
  if ("y" in layout) {
    const y = layout.y;
    if (typeof y !== "number" || !Number.isFinite(y)) {
      return {
        ok: false,
        error: {
          code: "scene.invalid-geometry",
          message: `Invalid y "${y}" for node "${nodeId}"`,
        },
      };
    }
  }
  return { ok: true };
}

const updateLayoutValidate = (
  scene: SceneGraph,
  action: UpdateLayoutAction,
  _ctx: RuntimeContext,
) => {
  if (!scene?.nodes) {
    return {
      ok: false,
      error: {
        code: "scene.invalid-scene",
        message: "Scene is null or missing nodes for action: update-layout",
      },
    };
  }
  if (!scene.nodes[action.nodeId]) {
    return {
      ok: false,
      error: {
        code: "scene.node-not-found",
        message: `Node not found for action: update-layout`,
      },
    };
  }
  const node = scene.nodes[action.nodeId] as any;
  const merged = {
    ...(node.layout ?? {}),
    ...action.layout,
  };
  return validateLayoutValue(merged, action.nodeId);
};

const updateLayoutInverse: InverseComputer<UpdateLayoutAction> = (
  sceneBefore,
  action,
  _context,
) => {
  const node = sceneBefore.nodes[action.nodeId];
  if (!node) return undefined;

  return {
    type: "update-layout",
    nodeId: action.nodeId,
    layout: node.layout ?? {},
  };
};

export const updateLayoutEntry = {
  handler: updateLayoutHandler,
  inverse: updateLayoutInverse,
  validate: updateLayoutValidate,
  meta: { undoable: true, mergeable: false, devtoolsLabel: "Update Layout" },
};
