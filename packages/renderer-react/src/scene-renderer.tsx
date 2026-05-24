import type { SceneNode } from "@ai-native/core";
import type { RenderContext, ComponentRenderer, ComponentRegistry } from "./renderer.js";
import { MissingPluginPlaceholder } from "./components/missing-plugin.jsx";
import { resolveLayoutStyle, wrapperNeeded } from "./layout-style.js";

function missingPluginFallback(n: SceneNode, ctx: RenderContext) {
  return MissingPluginPlaceholder({ nodeType: n.type, mode: ctx.mode });
}

function resolveRenderer(
  node: SceneNode,
  registry: ComponentRegistry,
): ComponentRenderer["render"] {
  return registry.get(node.type)?.render ?? missingPluginFallback;
}

function renderNode(
  node: SceneNode,
  registry: ComponentRegistry,
  ctx: RenderContext,
): React.ReactNode {
  if (node.visible === false) return null;

  const render = resolveRenderer(node, registry);
  const layoutStyle = resolveLayoutStyle(node);
  const isSelected = !!(
    ctx.mode === "editor" &&
    ctx.selection?.nodeIds.includes(node.id)
  );

  const childNodes = node.children
    ?.map((childId: string) => ctx.scene.nodes[childId])
    .filter((c): c is SceneNode => !!c)
    .map((child) => renderNode(child, registry, ctx)) ?? [];

  const content = render(node, ctx, childNodes);

  if (!wrapperNeeded(node, isSelected)) {
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
