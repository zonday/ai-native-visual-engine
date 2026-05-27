import type { DocumentAction } from "../document/actions.js";
import type { RuntimeAction } from "../runtime/actions.js";
import type { NodeId, PageId } from "../types.js";

export interface SerializedDocumentAction {
  actorId: string;
  timestamp: number;
  action: DocumentAction;
}

export interface SerializedRuntimeAction {
  actorId: string;
  timestamp: number;
  pageId: PageId;
  action: RuntimeAction;
}

export interface PeerUser {
  id: string;
  name: string;
  color: string;
}

export interface AwarenessState {
  user: PeerUser;
  cursor?: { x: number; y: number; pageId: PageId };
  selection?: { nodeIds: NodeId[]; pageId: PageId };
  viewport?: { zoom: number; x: number; y: number; pageId: PageId };
}
