import type { SceneGraph, SceneNode, VisualDocument } from "@ai-native/core";

type PersistedScene = VisualDocument["scenes"][string];
type PersistedNode = PersistedScene["nodes"][string];
type PersistedLayout = PersistedNode["layout"];

export function toPersistedLayout(
  layout: SceneNode["layout"],
): PersistedLayout {
  if (!layout || typeof layout !== "object") return undefined;

  const candidate = layout as Record<string, unknown>;
  switch (candidate.mode) {
    case "free":
      return { mode: "free" };
    case "absolute":
      return {
        mode: "absolute",
        x: typeof candidate.x === "number" ? candidate.x : undefined,
        y: typeof candidate.y === "number" ? candidate.y : undefined,
        width:
          typeof candidate.width === "number" ? candidate.width : undefined,
        height:
          typeof candidate.height === "number" ? candidate.height : undefined,
        rotation:
          typeof candidate.rotation === "number"
            ? candidate.rotation
            : undefined,
        zIndex:
          typeof candidate.zIndex === "number" ? candidate.zIndex : undefined,
      };
    case "flex":
      if (
        candidate.direction !== "horizontal" &&
        candidate.direction !== "vertical"
      ) {
        return undefined;
      }
      return {
        mode: "flex",
        direction: candidate.direction,
        gap: typeof candidate.gap === "number" ? candidate.gap : undefined,
        align:
          candidate.align === "start" ||
          candidate.align === "center" ||
          candidate.align === "end" ||
          candidate.align === "stretch"
            ? candidate.align
            : undefined,
        justify:
          candidate.justify === "start" ||
          candidate.justify === "center" ||
          candidate.justify === "end" ||
          candidate.justify === "space-between"
            ? candidate.justify
            : undefined,
        wrap: typeof candidate.wrap === "boolean" ? candidate.wrap : undefined,
      };
    case "grid":
      if (
        typeof candidate.columns !== "number" ||
        typeof candidate.rowHeight !== "number" ||
        typeof candidate.gap !== "number"
      ) {
        return undefined;
      }
      return {
        mode: "grid",
        columns: candidate.columns,
        rowHeight: candidate.rowHeight,
        gap: candidate.gap,
        autoFlow:
          candidate.autoFlow === "row" || candidate.autoFlow === "column"
            ? candidate.autoFlow
            : undefined,
      };
    case "grid-item":
      if (
        typeof candidate.x !== "number" ||
        typeof candidate.y !== "number" ||
        typeof candidate.w !== "number" ||
        typeof candidate.h !== "number"
      ) {
        return undefined;
      }
      return {
        mode: "grid-item",
        x: candidate.x,
        y: candidate.y,
        w: candidate.w,
        h: candidate.h,
        minW: typeof candidate.minW === "number" ? candidate.minW : undefined,
        minH: typeof candidate.minH === "number" ? candidate.minH : undefined,
        maxW: typeof candidate.maxW === "number" ? candidate.maxW : undefined,
        maxH: typeof candidate.maxH === "number" ? candidate.maxH : undefined,
      };
    default:
      return undefined;
  }
}

export function toPersistedNode(node: SceneNode): PersistedNode {
  return {
    id: node.id,
    type: node.type,
    name: node.name,
    parentId: node.parentId,
    children: node.children,
    props: node.props,
    style: node.style,
    layout: toPersistedLayout(node.layout),
    bindings: node.bindings,
    runtime: node.runtime,
    visible: node.visible,
    locked: node.locked,
    prototypeId: node.prototypeId,
  };
}

export function toPersistedScene(scene: SceneGraph): PersistedScene {
  return {
    version: scene.version,
    rootId: scene.rootId,
    nodes: Object.fromEntries(
      Object.entries(scene.nodes).map(([nodeId, node]) => [
        nodeId,
        toPersistedNode(node),
      ]),
    ),
    metadata: scene.metadata,
  };
}
