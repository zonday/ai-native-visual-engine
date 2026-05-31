import type { NodeId } from "../types.js";

export type NodeField =
  | "visible"
  | "layout"
  | "props"
  | "children"
  | "parent"
  | "style"
  | "bindings";

export type ScenePatch =
  | { type: "set-prop"; nodeId: NodeId; field: NodeField; key?: string }
  | { type: "reparent"; nodeId: NodeId; oldParent?: NodeId; newParent: NodeId }
  | { type: "add-node"; nodeId: NodeId }
  | { type: "remove-node"; nodeId: NodeId };
