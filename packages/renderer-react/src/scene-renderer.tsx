import type { SceneNode } from "@ai-native/core";
import { MissingPluginPlaceholder } from "./components/missing-plugin.jsx";
import { resolveLayoutStyle, wrapperNeeded } from "./layout-style.js";
import { MarqueeOverlay } from "./marquee-select.jsx";
import type {
  ComponentRegistry,
  ComponentRenderer,
  RenderContext,
} from "./renderer.js";
import { SelectionChrome } from "./selection-chrome.jsx";

function missingPluginFallback(n: SceneNode, ctx: RenderContext) {
  return MissingPluginPlaceholder({ nodeType: n.type, mode: ctx.mode });
}

function resolveRenderer(
  node: SceneNode,
  registry: ComponentRegistry,
): ComponentRenderer["render"] {
  return registry.get(node.type)?.render ?? missingPluginFallback;
}

export interface SelectNodeOptions {
  additive?: boolean;
}

export interface SceneRendererProps {
  registry: ComponentRegistry;
  context: RenderContext;
  onSelectNode?: (nodeId: string, options?: SelectNodeOptions) => void;
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
    ctx.mode === "editor" && ctx.selection?.nodeIds.includes(node.id)
  );

  const childNodes =
    node.children
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

  const wrapperStyle: React.CSSProperties = {
    position: "relative",
    ...style,
  };

  return (
    <div
      key={node.id}
      data-node-id={node.id}
      data-node-type={node.type}
      style={wrapperStyle}
    >
      {content}
      {isSelected && (
        <SelectionChrome
          nodeId={node.id}
          bounds={{
            width: typeof style.width === "number" ? style.width : 200,
            height: typeof style.height === "number" ? style.height : 100,
          }}
        />
      )}
    </div>
  );
}

function handleSceneClick(
  e: React.MouseEvent,
  scene: RenderContext["scene"],
  onSelectNode: SceneRendererProps["onSelectNode"],
): void {
  if (!onSelectNode) return;
  const target = e.target as HTMLElement;
  const wrapper = target.closest("[data-node-id]");
  if (!wrapper) return;
  const nodeId = wrapper.getAttribute("data-node-id");
  if (!nodeId) return;
  const isRoot = nodeId === scene.rootId;
  if (isRoot) return;
  e.stopPropagation();
  onSelectNode(nodeId, { additive: e.ctrlKey || e.metaKey || e.shiftKey });
}

export function SceneRenderer({
  registry,
  context,
  onSelectNode,
}: SceneRendererProps) {
  const root = context.scene.nodes[context.scene.rootId];
  if (!root) return null;

  const sceneClickHandler = (e: React.MouseEvent) => {
    handleSceneClick(e, context.scene, onSelectNode);
  };

  const rootContent = renderNode(root, registry, context);

  if (context.mode === "editor") {
    return (
      <div role="none" data-scene-root onClick={sceneClickHandler}>
        {rootContent}
        {context.marqueeRect && <MarqueeOverlay rect={context.marqueeRect} />}
      </div>
    );
  }

  return <>{rootContent}</>;
}
