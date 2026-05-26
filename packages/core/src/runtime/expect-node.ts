import { HandlerError } from "../engine/error.js";
import type { SceneGraph, SceneNode } from "../types.js";

export function expectNode(
  scene: SceneGraph,
  nodeId: string,
  actionType: string,
): SceneNode {
  const node = scene.nodes[nodeId];
  if (!node) {
    throw new HandlerError(
      "scene.node-not-found",
      `Node not found for action: ${actionType}`,
      actionType,
      { nodeId },
    );
  }
  return node;
}
