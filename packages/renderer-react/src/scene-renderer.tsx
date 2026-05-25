import type { SceneNode } from "@ai-native/core";
import { useEffect, useRef } from "react";
import { MissingPluginPlaceholder } from "./components/missing-plugin.jsx";
import { resolveLayoutStyle, wrapperNeeded } from "./layout-style.js";
import { MarqueeOverlay } from "./marquee-select.jsx";
import type {
  ComponentRegistry,
  ComponentRenderer,
  RenderContext,
  TransformEvent,
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
  onTransform?: (event: TransformEvent) => void;
}

function renderNode(
  node: SceneNode,
  registry: ComponentRegistry,
  ctx: RenderContext,
  onTransform?: SceneRendererProps["onTransform"],
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
      .map((child) => renderNode(child, registry, ctx, onTransform)) ?? [];

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

  const isLocked = node.locked === true;
  if (isLocked && ctx.mode === "editor") {
    style.opacity = 0.7;
    style.pointerEvents = "none";
  }

  const wrapperStyle: React.CSSProperties = {
    position: "relative",
    ...style,
  };

  // Only expose interactive transform chrome for non-locked nodes whose layout
  // mode supports transform actions (absolute or grid-item).
  const layoutMode =
    node.layout && typeof node.layout.mode === "string"
      ? node.layout.mode
      : undefined;
  const isTransformable =
    !isLocked && (layoutMode === "absolute" || layoutMode === "grid-item");

  return (
    <div
      key={node.id}
      data-node-id={node.id}
      data-node-type={node.type}
      style={wrapperStyle}
    >
      {content}
      {isSelected && isTransformable && (
        <SelectionChrome
          nodeId={node.id}
          layout={{ mode: layoutMode as "absolute" | "grid-item" }}
          onTransform={onTransform}
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
  onTransform,
}: SceneRendererProps) {
  const moveDragRef = useRef<{
    nodeId: string;
    startX: number;
    startY: number;
  } | null>(null);

  const didDragRef = useRef(false);

  const onTransformRef = useRef(onTransform);
  onTransformRef.current = onTransform;

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const drag = moveDragRef.current;
      if (!drag || !onTransformRef.current) return;
      didDragRef.current = true;
      const deltaX = e.clientX - drag.startX;
      const deltaY = e.clientY - drag.startY;
      onTransformRef.current({
        nodeId: drag.nodeId,
        type: "move",
        deltaX,
        deltaY,
        commit: false,
      });
    };

    const handleMouseUp = (e: MouseEvent) => {
      const drag = moveDragRef.current;
      if (!drag || !onTransformRef.current) return;
      if (didDragRef.current) {
        const deltaX = e.clientX - drag.startX;
        const deltaY = e.clientY - drag.startY;
        onTransformRef.current({
          nodeId: drag.nodeId,
          type: "move",
          deltaX,
          deltaY,
          commit: true,
        });
      }
      moveDragRef.current = null;
      didDragRef.current = false;
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    window.addEventListener("mouseup", handleMouseUp, { passive: true });
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  const root = context.scene.nodes[context.scene.rootId];
  if (!root) return null;

  const sceneMouseDown = (e: React.MouseEvent) => {
    if (!onTransform) return;
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    const wrapper = target.closest("[data-node-id]");
    if (!wrapper) return;
    const nodeId = wrapper.getAttribute("data-node-id");
    if (!nodeId) return;
    const node = context.scene.nodes[nodeId];
    if (!node) return;
    const isSelected =
      context.mode === "editor" &&
      !!context.selection?.nodeIds.includes(nodeId);
    if (!isSelected) return;
    if (node.locked === true) return;
    const layoutMode =
      node.layout && typeof node.layout.mode === "string"
        ? node.layout.mode
        : undefined;
    if (layoutMode !== "absolute" && layoutMode !== "grid-item") return;
    didDragRef.current = false;
    moveDragRef.current = { nodeId, startX: e.clientX, startY: e.clientY };
  };

  const sceneClickHandler = (e: React.MouseEvent) => {
    // After a drag, mouseup fires first and resets didDragRef to false.
    // This guard handles the edge case where click fires without a preceding
    // mouseup (e.g. simulated events in tests). In normal browser usage the
    // ref is already false here.
    if (didDragRef.current) {
      didDragRef.current = false;
      return;
    }
    handleSceneClick(e, context.scene, onSelectNode);
  };

  const rootContent = renderNode(root, registry, context, onTransform);

  if (context.mode === "editor") {
    return (
      <div
        role="none"
        data-scene-root
        onClick={sceneClickHandler}
        onMouseDown={sceneMouseDown}
      >
        {rootContent}
        {context.marqueeRect && <MarqueeOverlay rect={context.marqueeRect} />}
      </div>
    );
  }

  return <>{rootContent}</>;
}
