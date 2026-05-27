import { HandlerError } from "../../engine/error.js";
import type { UpdateLayoutAction } from "../actions.js";
import { expectNode } from "../expect-node.js";
import type { RuntimeHandler } from "../handler.js";
import type { InverseComputer } from "../handler-registry.js";

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

export const updateLayoutHandler: RuntimeHandler<UpdateLayoutAction> = (
  scene,
  action,
  _ctx,
) => {
  const node = expectNode(scene, action.nodeId, "update-layout");

  const merged = { ...(node.layout ?? {}), ...action.layout };
  validateLayout(merged, action.nodeId);

  const updatedNode = {
    ...node,
    layout: merged,
  };

  return {
    ...scene,
    nodes: { ...scene.nodes, [action.nodeId]: updatedNode },
    version: scene.version + 1,
  };
};

export const updateLayoutInverse: InverseComputer<UpdateLayoutAction> = (
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
