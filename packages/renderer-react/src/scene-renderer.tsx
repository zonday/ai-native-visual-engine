import type { SceneNode } from "@ai-native/core";
import { useEffect, useRef } from "react";
import { MissingPluginPlaceholder } from "./components/missing-plugin.jsx";
import { EditorCallbacksContext } from "./editor-callbacks.js";
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
  onUpdateProps?: (nodeId: string, props: Record<string, unknown>) => void;
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

  const isLocked = node.locked === true;
  if (isLocked && ctx.mode === "editor") {
    style.opacity = 0.7;
    style.pointerEvents = "none";
  }

  // Only expose interactive transform chrome for non-locked nodes whose layout
  // mode supports transform actions (absolute or grid-item).
  const layoutMode =
    node.layout && typeof node.layout.mode === "string"
      ? node.layout.mode
      : undefined;
  const isTransformable =
    !isLocked && (layoutMode === "absolute" || layoutMode === "grid-item");

  // Show move cursor on the wrapper so the user knows it can be dragged.
  if (isSelected && isTransformable) {
    style.cursor = "move";
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
          layout={layoutMode ? { mode: layoutMode } : undefined}
          onTransform={isTransformable ? onTransform : undefined}
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
  onUpdateProps,
}: SceneRendererProps) {
  const moveDragRef = useRef<{
    nodeId: string;
    startX: number;
    startY: number;
  } | null>(null);

  const didDragRef = useRef(false);

  const zoomRef = useRef(context.viewport?.zoom ?? 1);
  zoomRef.current = context.viewport?.zoom ?? 1;

  const onTransformRef = useRef(onTransform);
  onTransformRef.current = onTransform;

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const drag = moveDragRef.current;
      if (!drag || !onTransformRef.current) return;
      didDragRef.current = true;
      const zoom = zoomRef.current > 0 ? zoomRef.current : 1;
      const deltaX = (e.clientX - drag.startX) / zoom;
      const deltaY = (e.clientY - drag.startY) / zoom;
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
      if (!drag) return;
      if (onTransformRef.current && didDragRef.current) {
        const zoom = zoomRef.current > 0 ? zoomRef.current : 1;
        const deltaX = (e.clientX - drag.startX) / zoom;
        const deltaY = (e.clientY - drag.startY) / zoom;
        onTransformRef.current({
          nodeId: drag.nodeId,
          type: "move",
          deltaX,
          deltaY,
          commit: true,
        });
      }
      moveDragRef.current = null;
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
    // Clear stale didDragRef from a previous drag that ended with mouseup
    // outside the scene root (no click fired to consume it).
    didDragRef.current = false;
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
    moveDragRef.current = { nodeId, startX: e.clientX, startY: e.clientY };
  };

  const sceneClickHandler = (e: React.MouseEvent) => {
    // Suppress the click that follows a move-drag on the same node.
    // didDragRef is set by mousemove and consumed here; if mouseup
    // happened outside the scene root (no click follows), the stale
    // flag is cleared by the next mousedown via sceneMouseDown.
    if (didDragRef.current) {
      didDragRef.current = false;
      return;
    }
    handleSceneClick(e, context.scene, onSelectNode);
  };

  // Wrap onTransform so move/resize/rotate deltas emitted by SelectionChrome
  // are converted from screen-space (clientX/Y) to content-space, accounting
  // for the CSS viewport transform on the scene root.
  const zoomAdjustedOnTransform = onTransform
    ? (event: TransformEvent) => {
        const zoom = zoomRef.current > 0 ? zoomRef.current : 1;
        onTransform({
          ...event,
          deltaX: event.deltaX / zoom,
          deltaY: event.deltaY / zoom,
        });
      }
    : undefined;

  const rootContent = renderNode(
    root,
    registry,
    context,
    zoomAdjustedOnTransform,
  );

  const editorCallbacks = {
    onUpdateProps,
    onContentChange: onUpdateProps
      ? (nodeId: string, content: unknown) => onUpdateProps(nodeId, { content })
      : undefined,
  };

  if (context.mode === "editor") {
    const vp = context.viewport;
    const viewportStyle: React.CSSProperties | undefined =
      vp && vp.zoom > 0 && (vp.zoom !== 1 || vp.x !== 0 || vp.y !== 0)
        ? {
            transform: `scale(${vp.zoom}) translate(${-vp.x}px, ${-vp.y}px)`,
            transformOrigin: "0 0",
          }
        : undefined;

    return (
      <EditorCallbacksContext.Provider value={editorCallbacks}>
        <div
          role="none"
          data-scene-root
          onClick={sceneClickHandler}
          onMouseDown={sceneMouseDown}
          style={viewportStyle}
        >
          {rootContent}
          {context.marqueeRect && <MarqueeOverlay rect={context.marqueeRect} />}
        </div>
      </EditorCallbacksContext.Provider>
    );
  }

  return (
    <EditorCallbacksContext.Provider value={editorCallbacks}>
      {rootContent}
    </EditorCallbacksContext.Provider>
  );
}
