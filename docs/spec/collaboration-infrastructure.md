# Collaboration Infrastructure

## 1. Scope

This document defines the production-grade collaboration infrastructure: the server-side relay, authentication, per-document isolation, persistence, and deployment on Cloudflare.

## 2. Architecture

Each collaborative document maps to one Cloudflare Durable Object.

```text
Client (editor.ai-native.dev)
  -> WebSocket -> wss://collab.ai-native.dev/:documentId
  -> Cloudflare Worker (auth + routing)
  -> Durable Object (Yjs relay + state)
  -> R2 (snapshot persistence)
```

No persistent server cluster. Durable Objects provide:

1. A single-threaded, stateful instance per document.
2. Automatic geographic migration to the region closest to active editors.
3. In-memory Yjs document state with periodic R2 persistence.
4. WebSocket lifecycle management per connected peer.

## 3. Worker Entrypoint

The Worker authenticates the WebSocket upgrade request and routes to the correct Durable Object.

```ts
// src/collab/worker.ts
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const documentId = url.pathname.slice(1)

    if (!documentId) {
      return new Response('missing document id', { status: 400 })
    }

    // Authenticate the session
    const token = url.searchParams.get('token')
    if (!(await validateToken(token, documentId, env))) {
      return new Response('unauthorized', { status: 401 })
    }

    // Route to the Durable Object for this document
    const id = env.COLLAB_DO.idFromName(documentId)
    const stub = env.COLLAB_DO.get(id)

    return stub.fetch(request)
  },
}
```

## 4. Durable Object

The Durable Object holds the Yjs document in memory and relays updates between connected peers.

```ts
// src/collab/durable-object.ts
import { Doc } from 'yjs'

export class CollaborationDO extends DurableObject {
  private ydoc: Doc
  private sessions: Map<WebSocket, { userId: string }>
  private documentId: string
  private lastPersisted: number

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    this.ydoc = new Doc()
    this.sessions = new Map()
    this.lastPersisted = Date.now()

    // Restore from R2 on cold start
    ctx.blockConcurrencyWhile(async () => {
      await this.restoreFromR2(env)
    })
  }

  async fetch(request: Request): Promise<Response> {
    const pair = new WebSocketPair()
    const [client, server] = Object.values(pair)

    this.ctx.acceptWebSocket(server)

    return new Response(null, { status: 101, webSocket: client })
  }

  async webSocketMessage(ws: WebSocket, message: ArrayBuffer) {
    // Decode Yjs update from the sending peer
    const update = new Uint8Array(message)
    Y.applyUpdate(this.ydoc, update)

    // Relay to all other connected peers
    for (const [peer] of this.sessions) {
      if (peer !== ws) {
        peer.send(message)
      }
    }

    // Throttled persistence
    this.schedulePersist()
  }

  async webSocketClose(ws: WebSocket) {
    this.sessions.delete(ws)
  }

  async webSocketError(ws: WebSocket) {
    this.sessions.delete(ws)
  }
}
```

## 5. Authentication

The editor generates a short-lived token when a user opens a document. The Worker validates it on WebSocket upgrade.

```ts
// Token issued by the editor backend or a Cloudflare Worker
interface CollaborationToken {
  userId: string
  documentId: string
  exp: number   // expiry timestamp
  readOnly?: boolean
}

async function validateToken(
  token: string | null,
  documentId: string,
  env: Env
): Promise<boolean> {
  if (!token) return false

  try {
    const payload = await verifyJWT(token, env.JWT_SECRET)
    return payload.documentId === documentId && payload.exp > Date.now() / 1000
  } catch {
    return false
  }
}
```

Rules:

1. Tokens expire after a configurable duration (default 24 hours).
2. The token is embedded in the WebSocket URL, not in HTTP headers.
3. Read-only tokens allow presence and observation but reject action pushes at the Worker level.
4. Token issuance is handled by a separate auth Worker, not the collaboration Worker.

## 6. Persistence

The Durable Object periodically persists the Yjs document to R2.

```ts
async restoreFromR2(env: Env) {
  const object = await env.COLLAB_STATE.get(`${this.documentId}/snapshot`)
  if (object) {
    const buffer = await object.arrayBuffer()
    Y.applyUpdate(this.ydoc, new Uint8Array(buffer))
  }
}

async persistToR2(env: Env) {
  const update = Y.encodeStateAsUpdate(this.ydoc)
  await env.COLLAB_STATE.put(
    `${this.documentId}/snapshot`,
    update,
    { customMetadata: { persistedAt: String(Date.now()) } }
  )
  this.lastPersisted = Date.now()
}

schedulePersist() {
  // Persist at most once every 5 seconds
  if (Date.now() - this.lastPersisted < 5000) return
  this.ctx.waitUntil(this.persistToR2(this.env))
}
```

Rules:

1. The full Yjs document state is persisted as a binary snapshot to R2.
2. Persistence is throttled to at most once every 5 seconds.
3. On cold start, the Durable Object restores from the latest R2 snapshot.
4. If no snapshot exists, the DO starts with an empty Yjs document.
5. Event log persistence is handled separately by `persistence-and-serialization.md`.

## 7. Scaling

Durable Objects provide automatic per-document isolation and scaling.

| Concern | Mechanism |
|------|------|
| Document isolation | One DO instance per document ID |
| Geographic proximity | Cloudflare migrates the DO to the region nearest active editors |
| Memory limits | A single DO is limited by Cloudflare's DO memory cap; documents exceeding this need sharding (post-MVP) |
| Concurrent peers | A single DO handles all peers for one document; WebSocket fan-out is linear |
| Cold start | First connection after inactivity wakes the DO; R2 restore latency is < 200ms |

## 8. Deployment

```toml
# wrangler.toml
name = "ai-native-collab"
main = "src/collab/worker.ts"
compatibility_date = "2026-05-23"

[[durable_objects.bindings]]
name = "COLLAB_DO"
class_name = "CollaborationDO"

[[r2_buckets]]
binding = "COLLAB_STATE"
bucket_name = "ai-native-collab-state"

[[migrations]]
tag = "v1"
new_classes = ["CollaborationDO"]
```

## 9. Client Integration

The editor client uses `y-websocket` provider pointed at the Worker.

```ts
// packages/editor/src/collaboration/provider.ts
import { WebsocketProvider } from 'y-websocket'
import { Doc } from 'yjs'

export function createCollaborationProvider(
  documentId: string,
  ydoc: Doc,
  token: string
): WebsocketProvider {
  const url = `${import.meta.env.VITE_COLLAB_WS_URL}/${documentId}?token=${token}`

  return new WebsocketProvider(url, documentId, ydoc, {
    connect: true,
    maxBackoffTime: 10000,
  })
}
```

Environment variable:

```env
VITE_COLLAB_WS_URL=wss://collab.ai-native.dev
```

## 10. Read-Only Observers

A read-only token grants presence visibility and document observation without mutation rights.

```ts
if (session.readOnly) {
  // Apply incoming updates but reject outgoing payloads
  ws.addEventListener('message', (event) => {
    Y.applyUpdate(ydoc, new Uint8Array(event.data))
  })
}
```

Read-only observers see remote cursors, selections, and document changes in real time but cannot push their own changes.

## 11. Relationship To Other Specs

- `collaboration-framework.md`: Yjs client-side architecture and action transport
- `deployment.md`: Cloudflare Pages deployment for the editor SPA
- `persistence-and-serialization.md`: event log and snapshot persistence
- `history-and-undo-redo.md`: actor-local undo with remote action exclusion
