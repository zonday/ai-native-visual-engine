import type * as Y from "yjs";

export interface PeerInfo {
  id: string;
  name?: string;
  color?: string;
}

export interface CursorPosition {
  nodeId?: string;
  x: number;
  y: number;
}

export interface CollaborationState {
  connected: boolean;
  peers: PeerInfo[];
  undoStack: Array<{ type: string }>;
}
