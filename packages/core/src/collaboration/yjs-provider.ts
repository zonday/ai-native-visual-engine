import { WebsocketProvider } from "y-websocket";
import * as Y from "yjs";
import type { PageId } from "../types.js";
import type {
  AwarenessState,
  SerializedDocumentAction,
  SerializedRuntimeAction,
} from "./types.js";

export type {
  AwarenessState,
  SerializedDocumentAction,
  SerializedRuntimeAction,
} from "./types.js";

export interface YjsDocProvider {
  connect(serverUrl: string): void;
  disconnect(): void;
  getDoc(): Y.Doc;
  onRemoteDocumentAction(
    handler: (entry: SerializedDocumentAction) => void,
  ): () => void;
  onRemoteSceneAction(
    pageId: PageId,
    handler: (entry: SerializedRuntimeAction) => void,
  ): () => void;
  broadcastDocumentAction(entry: SerializedDocumentAction): void;
  broadcastSceneAction(entry: SerializedRuntimeAction): void;
  setAwareness(state: Partial<AwarenessState>): void;
  onAwarenessChange(handler: (peers: AwarenessState[]) => void): () => void;
  onConnectionChange(
    handler: (status: "connected" | "disconnected" | "connecting") => void,
  ): () => void;
  replayDocumentActions(
    onAction: (entry: SerializedDocumentAction) => void,
  ): void;
  replaySceneActions(
    pageId: PageId,
    onAction: (entry: SerializedRuntimeAction) => void,
  ): void;
}

function observeArray<T>(
  array: Y.Array<T>,
  handler: (item: T) => void,
): () => void {
  let locked = false;
  const observer = () => {
    if (locked) return;
    const item = array.get(array.length - 1);
    if (item !== undefined) {
      locked = true;
      try {
        handler(item);
      } finally {
        locked = false;
      }
    }
  };
  array.observe(observer);
  return () => array.unobserve(observer);
}

export function createYjsDocProvider(roomId: string): YjsDocProvider {
  const doc = new Y.Doc();
  const documentActions =
    doc.getArray<SerializedDocumentAction>("documentActions");
  const sceneActions =
    doc.getMap<Y.Array<SerializedRuntimeAction>>("sceneActions");
  let provider: WebsocketProvider | null = null;

  function getSceneArray(pageId: PageId): Y.Array<SerializedRuntimeAction> {
    let arr = sceneActions.get(pageId);
    if (!arr) {
      arr = new Y.Array<SerializedRuntimeAction>();
      sceneActions.set(pageId, arr);
    }
    return arr;
  }

  return {
    connect(serverUrl: string) {
      provider = new WebsocketProvider(serverUrl, roomId, doc);
    },

    disconnect() {
      provider?.awareness?.setLocalState(null);
      provider?.disconnect();
      provider = null;
    },

    getDoc() {
      return doc;
    },

    onRemoteDocumentAction(handler) {
      return observeArray(documentActions, handler);
    },

    onRemoteSceneAction(pageId, handler) {
      return observeArray(getSceneArray(pageId), handler);
    },

    broadcastDocumentAction(entry) {
      doc.transact(() => {
        documentActions.push([entry]);
      });
    },

    broadcastSceneAction(entry) {
      doc.transact(() => {
        getSceneArray(entry.pageId).push([entry]);
      });
    },

    setAwareness(state) {
      provider?.awareness?.setLocalState(state);
    },

    onAwarenessChange(handler) {
      const p = provider;
      if (!p?.awareness) return () => {};
      const update = () => {
        const states = p.awareness.getStates();
        const peers: AwarenessState[] = [];
        states.forEach((state) => {
          if (state && typeof state === "object") {
            peers.push(state as AwarenessState);
          }
        });
        handler(peers);
      };
      p.awareness.on("change", update);
      return () => p.awareness.off("change", update);
    },

    onConnectionChange(handler) {
      const p = provider;
      if (!p) return () => {};
      const cb = (event: {
        status: "connected" | "disconnected" | "connecting";
      }) => {
        handler(event.status);
      };
      p.on("status", cb);
      return () => p.off("status", cb);
    },

    replayDocumentActions(onAction) {
      for (let i = 0; i < documentActions.length; i++) {
        const item = documentActions.get(i);
        if (item) onAction(item);
      }
    },

    replaySceneActions(pageId, onAction) {
      const arr = sceneActions.get(pageId);
      if (!arr) return;
      for (let i = 0; i < arr.length; i++) {
        const item = arr.get(i);
        if (item) onAction(item);
      }
    },
  };
}
