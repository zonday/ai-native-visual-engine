import { DurableObject } from "cloudflare:workers";

interface Env {
  COLLAB_ROOM: DurableObjectNamespace<CollabRoom>;
  R2_LOGS: R2Bucket;
  JWT_SECRET: string;
}

class CollabRoom extends DurableObject {
  private sessions: Map<string, WebSocket> = new Map();

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected WebSocket", { status: 426 });
    }

    const token = new URL(request.url).searchParams.get("token");
    if (!token) {
      return new Response("Missing token", { status: 401 });
    }

    const valid = await verifyJwt(token, this.env.JWT_SECRET);
    if (!valid) {
      return new Response("Invalid token", { status: 401 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    if (!client || !server) {
      return new Response("WebSocket init failed", { status: 500 });
    }

    const sessionId = crypto.randomUUID();
    this.ctx.acceptWebSocket(server);
    this.sessions.set(sessionId, client);

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, raw: string) {
    const data = JSON.parse(raw) as { type: string; update?: number[] };
    if (data.type === "sync" && data.update) {
      const update = new Uint8Array(data.update);
      await this.env.R2_LOGS.put(
        `${Date.now()}-${crypto.randomUUID()}.bin`,
        update,
      );
    }

    for (const peer of this.sessions.values()) {
      if (peer !== ws && peer.readyState === WebSocket.READY_STATE_OPEN) {
        peer.send(raw);
      }
    }
  }

  async webSocketClose(ws: WebSocket) {
    for (const [id, peer] of this.sessions) {
      if (peer === ws) {
        this.sessions.delete(id);
        break;
      }
    }
  }

  async webSocketError(_ws: WebSocket, _error: unknown) {}
}

async function verifyJwt(token: string, secret: string): Promise<boolean> {
  try {
    const [headerB64, payloadB64, sigB64] = token.split(".");
    if (!headerB64 || !payloadB64 || !sigB64) return false;

    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );

    const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
    const sig = base64UrlDecode(sigB64);
    return crypto.subtle.verify("HMAC", key, sig, data);
  } catch {
    return false;
  }
}

function base64UrlDecode(str: string): Uint8Array {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padding = 4 - (base64.length % 4);
  const padded = base64 + (padding === 4 ? "" : "=".repeat(padding));
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

export { CollabRoom };
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const roomId = url.searchParams.get("room");
    if (!roomId) {
      return new Response("Missing room parameter", { status: 400 });
    }

    const id = env.COLLAB_ROOM.idFromName(roomId);
    const stub = env.COLLAB_ROOM.get(id);
    return stub.fetch(request);
  },
};
