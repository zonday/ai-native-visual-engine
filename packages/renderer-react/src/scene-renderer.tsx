import type {
  ComputedStateEngine,
  PrototypeComponent,
  SceneNode,
} from "@ai-native/core";
import { resolveInstance, resolveStateProps } from "@ai-native/core";
import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
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
  prototypeMap: Map<string, PrototypeComponent>,
  statesByType: Map<
    string,
    { stateProps: Map<string, Record<string, unknown>> }
  >,
  engine: ComputedStateEngine,
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
  const isSelected = !!(
    ctx.mode === "editor" && ctx.selection?.nodeIds.includes(node.id)
  );

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

  if (ctx.mode !== "editor" && !wrapperNeeded(resolvedNode, isSelected)) {
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

  // Only expose interactive transform chrome for non-locked nodes whose layout
  // mode supports transform actions (absolute or grid-item).
  const layoutMode =
    resolvedNode.layout && typeof resolvedNode.layout.mode === "string"
      ? resolvedNode.layout.mode
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

  const sceneRef = useRef(context.scene);
  sceneRef.current = context.scene;

  const contextRef = useRef(context);
  contextRef.current = context;

  const zoomRef = useRef(context.viewport?.zoom ?? 1);
  zoomRef.current = context.viewport?.zoom ?? 1;

  const onTransformRef = useRef(onTransform);
  onTransformRef.current = onTransform;

  const [, forceUpdate] = useReducer((x: number) => x + 1, 0);

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

  useEffect(() => {
    return context.scheduler.subscribe({
      onAfterCompute: () => forceUpdate(),
    });
  }, [context.scheduler]);

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
      handleSceneClick(e, sceneRef.current, onSelectNode);
    },
    [onSelectNode],
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
