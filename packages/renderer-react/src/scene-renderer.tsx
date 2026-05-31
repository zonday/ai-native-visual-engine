import type {
  ComputedStore,
  InteractionEngine,
  PrototypeComponent,
  SceneNode,
  ViewportState,
} from "@ai-native/core";
import { resolveInstance, resolveStateProps } from "@ai-native/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MissingPluginPlaceholder } from "./components/missing-plugin.jsx";
import { EditorCallbacksContext } from "./editor-callbacks.js";
import { resolveComputedLayoutStyle, wrapperNeeded } from "./layout-style.js";
import { MarqueeOverlay } from "./marquee-select.jsx";
import type {
  ComponentRegistry,
  ComponentRenderer,
  RenderContext,
  TransformEvent,
} from "./renderer.js";
import { SelectionOverlay } from "./selection-overlay.js";

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
  onViewportChange?: (viewport: ViewportState) => void;
  selectedIds?: string[];
}

function renderNode(
  node: SceneNode,
  registry: ComponentRegistry,
  ctx: RenderContext,
  prototypeMap: Map<string, PrototypeComponent>,
  statesByType: Map<
    string,
    { stateProps: Map<string, Record<string, unknown>> }
  >,
  engine: ComputedStore,
  onTransform?: SceneRendererProps["onTransform"],
): React.ReactNode {
  if (node.visible === false) return null;

  const prototype = node.prototypeId
    ? prototypeMap.get(node.prototypeId)
    : undefined;
  const resolved = resolveInstance(node, prototype);

  const stateMeta = statesByType.get(node.type);
  const runtimeActive = (node.runtime as Record<string, unknown> | undefined)
    ?.activeStates as string[] | undefined;
  const active = runtimeActive ?? node.activeStates ?? [];
  const stateProps = stateMeta
    ? resolveStateProps(active, stateMeta.stateProps)
    : {};
  const mergedProps = { ...resolved.props, ...stateProps };

  const resolvedNode: SceneNode = {
    ...node,
    props: mergedProps,
    style: resolved.style,
    layout: resolved.layout as SceneNode["layout"],
  };

  const render = resolveRenderer(resolvedNode, registry);
  const layoutStyle = resolveComputedLayoutStyle(resolvedNode, engine);

  const childNodes: React.ReactNode[] = [];
  if (node.children) {
    for (const childId of node.children) {
      const c = ctx.scene.nodes[childId];
      if (c) {
        childNodes.push(
          renderNode(
            c,
            registry,
            ctx,
            prototypeMap,
            statesByType,
            engine,
            onTransform,
          ),
        );
      }
    }
  }

  const content = render(resolvedNode, ctx, childNodes);

  if (ctx.mode !== "editor" && !wrapperNeeded(resolvedNode)) {
    return content;
  }

  const style: React.CSSProperties = {
    ...layoutStyle,
    ...(resolvedNode.style as React.CSSProperties | undefined),
  };

  const isLocked = node.locked === true;
  if (isLocked && ctx.mode === "editor") {
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
    </div>
  );
}

function handleSceneClick(
  e: React.MouseEvent,
  scene: RenderContext["scene"],
  onSelectNode: SceneRendererProps["onSelectNode"],
  interactionEngine?: InteractionEngine,
  computedEngine?: ComputedStore,
): void {
  if (!onSelectNode) return;

  // Try hitTest first when interaction engine + computed engine are available
  if (interactionEngine && computedEngine) {
    const rect = e.currentTarget.getBoundingClientRect();
    const sceneX = e.clientX - rect.left;
    const sceneY = e.clientY - rect.top;
    const nodeId = interactionEngine.hitTest(
      sceneX,
      sceneY,
      scene,
      computedEngine,
    );
    if (nodeId) {
      onSelectNode(nodeId, { additive: e.ctrlKey || e.metaKey || e.shiftKey });
      return;
    }
  }

  // Fallback: DOM-based approach
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
  onViewportChange,
  selectedIds,
}: SceneRendererProps) {
  const sceneContainerRef = useRef<HTMLDivElement | null>(null);
  const moveDragRef = useRef<{
    nodeId: string;
    startX: number;
    startY: number;
  } | null>(null);

  const didDragRef = useRef(false);

  const sceneRef = useRef(context.scene);
  sceneRef.current = context.scene;

  const contextRef = useRef(context);
  contextRef.current = context;

  const zoomRef = useRef(context.viewport?.zoom ?? 1);
  zoomRef.current = context.viewport?.zoom ?? 1;

  const onTransformRef = useRef(onTransform);
  onTransformRef.current = onTransform;

  const onViewportChangeRef = useRef(onViewportChange);
  onViewportChangeRef.current = onViewportChange;

  const panRef = useRef<{
    startX: number;
    startY: number;
    origVpX: number;
    origVpY: number;
  } | null>(null);

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const pan = panRef.current;
      if (pan) {
        const dx = e.clientX - pan.startX;
        const dy = e.clientY - pan.startY;
        onViewportChangeRef.current?.({
          x: pan.origVpX + dx,
          y: pan.origVpY + dy,
          zoom: zoomRef.current,
        });
        return;
      }
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
      const pan = panRef.current;
      if (pan) {
        panRef.current = null;
        return;
      }
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

  const editorCallbacks = useMemo(
    () => ({
      onUpdateProps,
      onContentChange: onUpdateProps
        ? (nodeId: string, content: unknown) =>
            onUpdateProps(nodeId, { content })
        : undefined,
    }),
    [onUpdateProps],
  );

  const zoomAdjustedOnTransform = useCallback(
    (event: TransformEvent) => {
      if (!onTransform) return;
      const zoom = zoomRef.current > 0 ? zoomRef.current : 1;
      onTransform({
        ...event,
        deltaX: event.deltaX / zoom,
        deltaY: event.deltaY / zoom,
      });
    },
    [onTransform],
  );

  const prototypeMap = useMemo(() => {
    const map = new Map<string, PrototypeComponent>();
    for (const p of context.prototypes ?? []) {
      map.set(p.id, p);
    }
    return map;
  }, [context.prototypes]);

  const viewportStyle: React.CSSProperties | undefined = useMemo(() => {
    const vp = context.viewport;
    if (!vp || vp.zoom <= 0 || (vp.zoom === 1 && vp.x === 0 && vp.y === 0)) {
      return undefined;
    }
    return {
      transform: `scale(${vp.zoom}) translate(${-vp.x}px, ${-vp.y}px)`,
      transformOrigin: "0 0",
    };
  }, [context.viewport]);

  const sceneMouseDown = useCallback(
    (e: React.MouseEvent) => {
      didDragRef.current = false;
      // Middle mouse button — start pan
      if (e.button === 1) {
        e.preventDefault();
        didDragRef.current = true;
        const vp = contextRef.current.viewport ?? { x: 0, y: 0, zoom: 1 };
        panRef.current = {
          startX: e.clientX,
          startY: e.clientY,
          origVpX: vp.x,
          origVpY: vp.y,
        };
        return;
      }
      if (!onTransform) return;
      if (e.button !== 0) return;
      const target = e.target as HTMLElement;
      const wrapper = target.closest("[data-node-id]");
      if (!wrapper) return;
      const nodeId = wrapper.getAttribute("data-node-id");
      if (!nodeId) return;
      const scene = sceneRef.current;
      const node = scene.nodes[nodeId];
      if (!node) return;
      const ctx = contextRef.current;
      const isSelected =
        ctx.mode === "editor" && !!ctx.selection?.nodeIds.includes(nodeId);
      if (!isSelected) return;
      if (node.locked === true) return;
      const p = node.prototypeId
        ? prototypeMap.get(node.prototypeId)
        : undefined;
      const resolved = resolveInstance(node, p);
      const layoutMode =
        resolved.layout && typeof resolved.layout.mode === "string"
          ? resolved.layout.mode
          : undefined;
      if (layoutMode !== "absolute" && layoutMode !== "grid-item") return;
      moveDragRef.current = { nodeId, startX: e.clientX, startY: e.clientY };
    },
    [onTransform, prototypeMap],
  );

  const sceneClickHandler = useCallback(
    (e: React.MouseEvent) => {
      if (didDragRef.current) {
        didDragRef.current = false;
        return;
      }
      handleSceneClick(
        e,
        sceneRef.current,
        onSelectNode,
        context.interactionEngine,
        context.computedEngine,
      );
    },
    [onSelectNode, context.interactionEngine, context.computedEngine],
  );

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (!onViewportChange) return;
      const vp = contextRef.current.viewport ?? { x: 0, y: 0, zoom: 1 };
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = -e.deltaY * 0.001;
        const newZoom = Math.max(0.1, Math.min(10, vp.zoom * (1 + delta)));
        onViewportChange({ ...vp, zoom: newZoom });
      } else {
        e.preventDefault();
        onViewportChange({ ...vp, x: vp.x + e.deltaX, y: vp.y + e.deltaY });
      }
    },
    [onViewportChange],
  );

  const statesByType = useMemo(() => {
    const map = new Map<
      string,
      {
        stateProps: Map<string, Record<string, unknown>>;
      }
    >();
    for (const plugin of context.plugins ?? []) {
      if (plugin.meta.states && plugin.meta.states.length > 0) {
        const stateProps = new Map<string, Record<string, unknown>>();
        for (const s of plugin.meta.states) {
          stateProps.set(s.name, s.props);
        }
        map.set(plugin.type, {
          stateProps,
        });
      }
    }
    return map;
  }, [context.plugins]);

  const root = context.scene.nodes[context.scene.rootId];
  if (!root) return null;

  const rootContent = renderNode(
    root,
    registry,
    context,
    prototypeMap,
    statesByType,
    context.computedEngine,
    zoomAdjustedOnTransform,
  );

  if (context.mode === "editor") {
    return (
      <EditorCallbacksContext.Provider value={editorCallbacks}>
        <style>
          {`.ProseMirror p.is-editor-empty:first-child::before {
            content: attr(data-placeholder);
            color: #9ca3af;
            pointer-events: none;
            float: left;
            height: 0;
          }`}
        </style>
        <div style={{ position: "relative", ...viewportStyle }}>
          <div
            ref={sceneContainerRef}
            role="none"
            data-scene-root
            onClick={sceneClickHandler}
            onMouseDown={sceneMouseDown}
            onWheel={handleWheel}
          >
            {rootContent}
            {context.marqueeRect && (
              <MarqueeOverlay rect={context.marqueeRect} />
            )}
          </div>
          {mounted && (
            <SelectionOverlay
              selectedIds={selectedIds ?? []}
              sceneContainerRef={sceneContainerRef}
              onTransform={onTransform}
              layoutByNode={selectedIds?.reduce(
                (acc, id) => {
                  const node = context.scene.nodes[id];
                  if (node?.layout?.mode) {
                    acc[id] = { mode: node.layout.mode as string };
                  }
                  return acc;
                },
                {} as Record<string, { mode: string }>,
              )}
            />
          )}
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
