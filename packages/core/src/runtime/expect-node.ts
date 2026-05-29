import { HandlerError } from "../engine/error.js";
import type { SceneGraph, SceneNode } from "../types.js";

export function expectNode(
  scene: SceneGraph,
  nodeId: string,
  actionType: string,
): SceneNode {
  if (!scene?.nodes) {
    throw new HandlerError(
      "scene.invalid-scene",
      `Scene is null or missing nodes for action: ${actionType}`,
      actionType,
      { nodeId },
    );
  }
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
