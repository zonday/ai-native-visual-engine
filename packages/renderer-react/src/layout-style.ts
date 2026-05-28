import type { ComputedStateEngine, SceneNode } from "@ai-native/core";

export function resolveLayoutStyle(node: SceneNode): React.CSSProperties {
  const layout = node.layout;
  if (!layout) return {};

  if (layout.mode === "absolute") {
    const style: React.CSSProperties = { position: "absolute" };
    if (typeof layout.x === "number") style.left = layout.x;
    if (typeof layout.y === "number") style.top = layout.y;
    if (typeof layout.width === "number") style.width = layout.width;
    if (typeof layout.height === "number") style.height = layout.height;
    if (typeof layout.zIndex === "number") style.zIndex = layout.zIndex;
    if (typeof layout.rotation === "number")
      style.transform = `rotate(${layout.rotation}deg)`;
    return style;
  }

  if (layout.mode === "grid-item") {
    const style: React.CSSProperties = {};
    if (typeof layout.x === "number") style.gridColumn = layout.x + 1;
    if (typeof layout.y === "number") style.gridRow = layout.y + 1;
    if (typeof layout.w === "number") style.gridColumnEnd = `span ${layout.w}`;
    if (typeof layout.h === "number") style.gridRowEnd = `span ${layout.h}`;
    return style;
  }

  return {};
}

export function resolveComputedLayoutStyle(
  node: SceneNode,
  engine: ComputedStateEngine,
): React.CSSProperties {
  const mode =
    node.layout && typeof node.layout.mode === "string"
      ? node.layout.mode
      : undefined;

  // Only apply computed world transforms for absolute-positioned nodes.
  // Flex, grid, and other layout modes use the browser's native layout.
  if (mode !== "absolute") return resolveLayoutStyle(node);

  const tx = engine.getWorldTransform(node.id);
  const bounds = engine.getComputedBounds(node.id);
  const style: React.CSSProperties = { position: "absolute" };
  style.left = tx.x;
  style.top = tx.y;
  style.width = bounds.width;
  style.height = bounds.height;
  if (tx.rotation) style.transform = `rotate(${tx.rotation}deg)`;
  return style;
}

export function resolveFlexStyle(node: SceneNode): React.CSSProperties {
  const layout = node.layout;
  const style: React.CSSProperties = { display: "flex", position: "relative" };
  if (!layout || layout.mode !== "flex") return style;

  if (layout.direction)
    style.flexDirection =
      layout.direction as React.CSSProperties["flexDirection"];
  if (typeof layout.gap === "number") style.gap = layout.gap;
  if (typeof layout.padding === "number") style.padding = layout.padding;
  if (layout.align)
    style.alignItems = layout.align as React.CSSProperties["alignItems"];
  if (layout.justify)
    style.justifyContent =
      layout.justify as React.CSSProperties["justifyContent"];
  if (layout.wrap) style.flexWrap = "wrap";
  if (typeof layout.width === "number") style.width = layout.width;
  if (typeof layout.height === "number") style.height = layout.height;
  return style;
}

export function resolveGridStyle(node: SceneNode): React.CSSProperties {
  const layout = node.layout;
  const style: React.CSSProperties = { display: "grid", position: "relative" };
  if (!layout || layout.mode !== "grid") return style;

  if (layout.columns)
    style.gridTemplateColumns = `repeat(${layout.columns}, 1fr)`;
  if (typeof layout.rowHeight === "number")
    style.gridAutoRows = layout.rowHeight;
  if (layout.autoFlow)
    style.gridAutoFlow = layout.autoFlow as React.CSSProperties["gridAutoFlow"];
  if (typeof layout.gap === "number") style.gap = layout.gap;
  if (typeof layout.padding === "number") style.padding = layout.padding;
  if (typeof layout.width === "number") style.width = layout.width;
  if (typeof layout.height === "number") style.height = layout.height;
  return style;
}

export function wrapperNeeded(node: SceneNode, isSelected: boolean): boolean {
  const layout = node.layout;
  return (
    isSelected ||
    layout?.mode === "absolute" ||
    layout?.mode === "grid-item" ||
    node.locked === true
  );
}
