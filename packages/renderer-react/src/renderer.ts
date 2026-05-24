import type {
  PageId,
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
}

export interface ComponentRenderer {
  type: string;
  render: (
    node: SceneNode,
    ctx: RenderContext,
    children?: React.ReactNode,
  ) => React.ReactNode;
}

export type ComponentRegistry = Map<string, ComponentRenderer>;

export interface ResolvedRenderNode {
  nodeId: string;
  type: string;
  output: React.ReactNode;
  children: ResolvedRenderNode[];
}
