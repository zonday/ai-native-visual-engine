import { WebsocketProvider } from "y-websocket";
import * as Y from "yjs";

export interface PeerInfo {
  id: string;
  name?: string;
  color?: string;
}

export interface YjsDocProvider {
  connect(serverUrl: string): void;
  disconnect(): void;
  getDoc(): Y.Doc;
  onRemoteAction(handler: (action: unknown) => void): () => void;
  broadcastAction(action: unknown): void;
  setAwareness(
    info: PeerInfo & { cursor?: { nodeId?: string; x: number; y: number } },
  ): void;
  onAwarenessChange(handler: (peers: PeerInfo[]) => void): () => void;
  onConnectionChange(
    handler: (status: "connected" | "disconnected" | "connecting") => void,
  ): () => void;
}

export function createYjsDocProvider(roomId: string): YjsDocProvider {
  const doc = new Y.Doc();
  const actions = doc.getArray<unknown>("actions");
  let provider: WebsocketProvider | null = null;
  let remoteLock = false;

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

    onRemoteAction(handler: (action: unknown) => void): () => void {
      const observer = () => {
        if (remoteLock) return;
        const item = actions.get(actions.length - 1);
        if (item) {
          remoteLock = true;
          try {
            handler(item);
          } finally {
            remoteLock = false;
          }
        }
      };
      actions.observe(observer);
      return () => actions.unobserve(observer);
    },

    broadcastAction(action: unknown) {
      doc.transact(() => {
        actions.push([action]);
      });
    },

    setAwareness(
      info: PeerInfo & { cursor?: { nodeId?: string; x: number; y: number } },
    ) {
      provider?.awareness?.setLocalState(info);
    },

    onAwarenessChange(handler: (peers: PeerInfo[]) => void): () => void {
      const p = provider;
      if (!p?.awareness) return () => {};
      const update = () => {
        const states = p.awareness.getStates();
        const peers: PeerInfo[] = [];
        states.forEach((state) => {
          if (state && typeof state === "object" && "id" in state) {
            peers.push(state as PeerInfo);
          }
        });
        handler(peers);
      };
      p.awareness.on("change", update);
      return () => p.awareness.off("change", update);
    },

    onConnectionChange(
      handler: (status: "connected" | "disconnected" | "connecting") => void,
    ): () => void {
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
  };
}
