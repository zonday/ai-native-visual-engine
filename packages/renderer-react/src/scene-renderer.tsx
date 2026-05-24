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
  const layout = node.layout as Record<string, unknown> | undefined;
  if (!layout) return {};

  const style: React.CSSProperties = {};

  if (layout.mode === "absolute") {
    if (typeof layout.x === "number") style.left = layout.x;
    if (typeof layout.y === "number") style.top = layout.y;
    if (typeof layout.width === "number") style.width = layout.width;
    if (typeof layout.height === "number") style.height = layout.height;
    style.position = "absolute";
    if (typeof layout.rotation === "number") {
      style.transform = `rotate(${layout.rotation}deg)`;
    }
  }

  if (layout.mode === "flex") {
    style.display = "flex";
    if (layout.direction) style.flexDirection = layout.direction as React.CSSProperties["flexDirection"];
    if (typeof layout.gap === "number") style.gap = layout.gap;
  }

  if (layout.mode === "grid") {
    style.display = "grid";
    if (typeof layout.columns === "number") style.gridTemplateColumns = `repeat(${layout.columns}, 1fr)`;
    if (typeof layout.gap === "number") style.gap = layout.gap;
  }

  if (layout.mode === "grid-item") {
    if (typeof layout.x === "number") style.gridColumn = layout.x + 1;
    if (typeof layout.y === "number") style.gridRow = layout.y + 1;
    if (typeof layout.w === "number") style.gridColumnEnd = `span ${layout.w}`;
    if (typeof layout.h === "number") style.gridRowEnd = `span ${layout.h}`;
  }

  return style;
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

  const style: React.CSSProperties = {
    ...layoutStyle,
    ...(node.style as React.CSSProperties | undefined),
  };

  if (isSelected) {
    style.outline = "2px solid #3b82f6";
    style.outlineOffset = "1px";
  }

  const content = render(node, ctx);

  const children = node.children?.map((childId: string) => {
    const child = ctx.scene.nodes[childId];
    if (!child) return null;
    return renderNode(child, registry, ctx);
  });

  if (children?.length || content) {
    return (
      <div key={node.id} data-node-id={node.id} data-node-type={node.type} style={style}>
        {content}
        {children}
      </div>
    );
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
