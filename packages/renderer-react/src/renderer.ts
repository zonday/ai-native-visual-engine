import type { SceneGraph, SceneNode, SelectionState, ViewportState, PageId } from "@ai-native/core";

export interface RenderContext {
  mode: "editor" | "runtime";
  pageId: PageId;
  scene: SceneGraph;
  selection?: SelectionState;
  viewport?: ViewportState;
}

export interface ComponentRenderer {
  type: string;
  render: (node: SceneNode, ctx: RenderContext) => React.ReactNode;
}

export type ComponentRegistry = Map<string, ComponentRenderer>;
