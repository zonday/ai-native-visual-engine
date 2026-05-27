import { DurableObject } from "cloudflare:workers";
import * as Y from "yjs";

export class CollaborationDO extends DurableObject {
  private sessions: Map<string, WebSocket> = new Map();
  private ydoc: Y.Doc;
  private persistTimer: ReturnType<typeof setInterval> | null = null;

  constructor(ctx: DurableObjectState, env: Record<string, unknown>) {
    super(ctx, env);
    this.ydoc = new Y.Doc();
    this.restoreFromR2();

    this.ydoc.on("update", () => {
      this.schedulePersist();
    });
  }

  private async restoreFromR2() {
    const bucket = this.env.COLLAB_STATE as R2Bucket;
    const key = `snapshot/${this.ctx.id.toString()}`;
    const obj = await bucket.get(key);
    if (obj) {
      const buffer = await obj.arrayBuffer();
      Y.applyUpdate(this.ydoc, new Uint8Array(buffer));
    }
  }

  private persistThrottled = false;
  private schedulePersist() {
    if (this.persistThrottled) return;
    this.persistThrottled = true;
    setTimeout(() => {
      this.persist();
      this.persistThrottled = false;
    }, 5000);
  }

  private async persist() {
    const bucket = this.env.COLLAB_STATE as R2Bucket;
    const key = `snapshot/${this.ctx.id.toString()}`;
    const state = Y.encodeStateAsUpdate(this.ydoc);
    await bucket.put(key, state);
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected WebSocket", { status: 426 });
    }

    const token = new URL(request.url).searchParams.get("token");
    if (!token) {
      return new Response("Missing token", { status: 401 });
    }

    const valid = await this.verifyJwt(token);
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

    const snapshot = Y.encodeStateAsUpdate(this.ydoc);
    client.send(snapshot);

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, raw: string) {
    try {
      const parsed = JSON.parse(raw) as { type: string; update?: number[] };
      if (parsed.type === "sync" && parsed.update) {
        const update = new Uint8Array(parsed.update);
        Y.applyUpdate(this.ydoc, update);
      }
    } catch {
      // Binary Yjs update
      const buffer = new Uint8Array(raw as unknown as ArrayBuffer);
      Y.applyUpdate(this.ydoc, buffer);
    }

    for (const [_id, peer] of this.sessions) {
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
    if (this.persistTimer) clearInterval(this.persistTimer);
  }

  async webSocketError(_ws: WebSocket, _error: unknown) {}

  private async verifyJwt(token: string): Promise<boolean> {
    try {
      const [headerB64, payloadB64, sigB64] = token.split(".");
      if (!headerB64 || !payloadB64 || !sigB64) return false;

      const key = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(this.env.JWT_SECRET as string),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["verify"],
      );

      const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
      const sig = this.base64UrlDecode(sigB64);
      return crypto.subtle.verify("HMAC", key, sig, data);
    } catch {
      return false;
    }
  }

  private base64UrlDecode(str: string): Uint8Array {
    const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
    const padding = 4 - (base64.length % 4);
    const padded = base64 + (padding === 4 ? "" : "=".repeat(padding));
    return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
  }
}
