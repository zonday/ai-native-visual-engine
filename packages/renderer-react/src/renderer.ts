import type {
  PageId,
  PrototypeComponent,
  SceneGraph,
  SceneNode,
  SelectionState,
  ViewportState,
} from "@ai-native/core";

export interface MarqueeRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RenderContext {
  mode: "editor" | "runtime";
  pageId: PageId;
  scene: SceneGraph;
  selection?: SelectionState;
  viewport?: ViewportState;
  marqueeRect?: MarqueeRect;
  prototypes?: PrototypeComponent[];
}

export interface ComponentRenderer {
  type: string;
  render: (
    node: SceneNode,
    ctx: RenderContext,
    children?: React.ReactNode,
  ) => React.ReactNode;
}

export interface TransformEvent {
  nodeId: string;
  type: "resize" | "move" | "rotate";
  handle?: string;
  deltaX: number;
  deltaY: number;
  commit: boolean;
}

export type ComponentRegistry = Map<string, ComponentRenderer>;

export interface ResolvedRenderNode {
  nodeId: string;
  type: string;
  output: React.ReactNode;
  children: ResolvedRenderNode[];
}
