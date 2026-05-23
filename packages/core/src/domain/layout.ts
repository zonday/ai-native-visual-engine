export type Layout =
  | FreeLayout
  | AbsoluteLayout
  | FlexLayout
  | GridLayout
  | GridItemLayout;

export interface LayoutBase {
  mode: "free" | "absolute" | "flex" | "grid" | "grid-item";
}

export interface FreeLayout extends LayoutBase {
  mode: "free";
}

export interface AbsoluteLayout extends LayoutBase {
  mode: "absolute";
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  rotation?: number;
  zIndex?: number;
}

export interface FlexLayout extends LayoutBase {
  mode: "flex";
  direction: "horizontal" | "vertical";
  gap?: number;
  align?: "start" | "center" | "end" | "stretch";
  justify?: "start" | "center" | "end" | "space-between";
  wrap?: boolean;
}

export interface GridLayout extends LayoutBase {
  mode: "grid";
  columns: number;
  rowHeight: number;
  gap: number;
  autoFlow?: "row" | "column";
}

export interface GridItemLayout extends LayoutBase {
  mode: "grid-item";
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
}
