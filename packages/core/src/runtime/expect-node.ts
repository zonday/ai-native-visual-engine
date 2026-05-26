import type { SceneGraph, SceneNode } from "../types.js";
import { RuntimeHandlerError } from "./error.js";

export function expectNode(
  scene: SceneGraph,
  nodeId: string,
  actionType: string,
): SceneNode {
  const node = scene.nodes[nodeId];
  if (!node) {
    throw new RuntimeHandlerError(
      "scene.node-not-found",
      `Node not found for action: ${actionType}`,
      actionType,
      nodeId,
    );
  }
  return node;
}
