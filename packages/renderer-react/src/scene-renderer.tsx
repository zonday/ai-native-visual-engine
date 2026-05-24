import type { SceneNode } from "@ai-native/core";
import type { RenderContext, ComponentRenderer, ComponentRegistry } from "./renderer.js";
import { MissingPluginPlaceholder } from "./components/missing-plugin.jsx";

function resolveRenderer(
  node: SceneNode,
  registry: ComponentRegistry,
): ComponentRenderer["render"] {
  const entry = registry.get(node.type);
  if (entry) return entry.render;
  return (n: SceneNode, ctx: RenderContext) => MissingPluginPlaceholder({ nodeType: n.type, mode: ctx.mode });
}

function getLayoutStyle(node: SceneNode): React.CSSProperties {
  const layout = node.layout;
  if (!layout) return {};

  if (layout.mode === "absolute") {
    const style: React.CSSProperties = { position: "absolute" };
    if (typeof layout.x === "number") style.left = layout.x;
    if (typeof layout.y === "number") style.top = layout.y;
    if (typeof layout.width === "number") style.width = layout.width;
    if (typeof layout.height === "number") style.height = layout.height;
    if (typeof layout.zIndex === "number") style.zIndex = layout.zIndex;
    if (typeof layout.rotation === "number") {
      style.transform = `rotate(${layout.rotation}deg)`;
    }
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

function renderNode(
  node: SceneNode,
  registry: ComponentRegistry,
  ctx: RenderContext,
): React.ReactNode {
  if (node.visible === false) return null;

  const render = resolveRenderer(node, registry);
  const layoutStyle = getLayoutStyle(node);
  const isSelected =
    ctx.mode === "editor" &&
    ctx.selection?.nodeIds.includes(node.id);

  const childNodes = node.children
    ?.map((childId: string) => ctx.scene.nodes[childId])
    .filter((c): c is SceneNode => !!c)
    .map((child) => renderNode(child, registry, ctx)) ?? [];

  const content = render(node, ctx, childNodes);

  const needsWrapper = isSelected ||
    layoutStyle.position === "absolute" ||
    layoutStyle.gridColumn !== undefined ||
    node.locked === true;

  if (!needsWrapper) {
    return content;
  }

  const style: React.CSSProperties = {
    ...layoutStyle,
    ...(node.style as React.CSSProperties | undefined),
  };

  if (isSelected) {
    style.outline = "2px solid #3b82f6";
    style.outlineOffset = "1px";
  }

  if (node.locked === true && ctx.mode === "editor") {
    style.opacity = 0.7;
    style.pointerEvents = "none";
  }

  return (
    <div key={node.id} data-node-id={node.id} data-node-type={node.type} style={style}>
      {content}
    </div>
  );
}

export interface SceneRendererProps {
  registry: ComponentRegistry;
  context: RenderContext;
}

export function SceneRenderer({ registry, context }: SceneRendererProps) {
  const root = context.scene.nodes[context.scene.rootId];
  if (!root) return null;

  return <>{renderNode(root, registry, context)}</>;
}
