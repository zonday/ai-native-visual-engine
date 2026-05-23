# Collaboration Framework

## 1. Scope

This document defines the collaboration model: the selected transport framework, how durable actions and ephemeral presence are transmitted, and how concurrent edits converge deterministically.

## 2. Framework Selection

The engine uses **Yjs** as the collaboration transport and convergence layer.

Reasons for Yjs over alternatives:

1. CRDT-based conflict resolution requires no central coordination for merge decisions.
2. Built-in awareness protocol separates durable state from ephemeral presence.
3. The engine already models all durable mutations as serializable JSON actions; Yjs shared types carry those actions without replacing the action model.
4. Yjs operates over any transport (WebSocket, WebRTC) and works offline with automatic re-sync.
5. Rich TypeScript support and active maintenance.

## 3. Architecture

```text
Local Editor
  -> commit DocumentAction / RuntimeAction
  -> push to Yjs shared document
  -> Yjs syncs to remote peers

Remote Peer
  -> Yjs applies remote action to local shared document
  -> observer fires
  -> dispatch action through local CommandBus
  -> state updates (no undo stack entry)
```

Rules:

1. Yjs transports serialized actions, not raw scene mutations.
2. The action model remains the engine-level contract.
3. Yjs is the transport and convergence layer; the engine is the semantic layer.
4. Direct Yjs shared types on scene data (e.g., Y.Map on node props) are explicitly rejected because they would bypass validation, inverse-action computation, and the middleware pipeline.

## 4. Shared Document Structure

Each collaborative document maps to a Yjs Y.Doc.

```ts
interface CollaborationDoc {
  documentActions: Y.Array<SerializedDocumentAction>

  sceneActions: Y.Map<Y.Array<SerializedRuntimeAction>>
}
```

Presence is carried through Yjs awareness (see §7), not through shared types inside `Y.Doc`.

Rules:

1. `documentActions` is an append-only ordered list. Each item is one `DocumentAction` serialized as JSON.
2. `sceneActions` is a Y.Map keyed by `pageId`, each value is an append-only ordered list of `RuntimeAction` in JSON.
3. Presence state uses Yjs awareness, is excluded from `Y.Doc` shared types, and is excluded from persistence and replay.
4. Each peer has exactly one open Y.Doc per collaborative session.

## 5. Action Transport

### 5.1 Local Commit To Sync

```text
1. User commits action via CommandBus (document or runtime)
2. Middleware pipeline runs (validation -> undo/history -> collaboration)
3. Collaboration middleware serializes the action to JSON
4. Pushes serialized action to the appropriate Y.Array
5. Yjs syncs the update to all connected peers
```

### 5.2 Remote Sync To Local Dispatch

```text
1. Yjs receives an update from a remote peer
2. Y.Array observer fires with the new action
3. Collaboration middleware deserializes the action
4. Dispatches the action through the local CommandBus
5. History middleware skips the undo stack (remote action, not local)
6. Validator runs normally (remote actions must still be valid)
```

### 5.3 Remote Action Pipeline Entry

Remote actions re-enter the middleware pipeline at the Validator stage, skipping Logger (to avoid double-logging) and skipping the History middleware (to avoid entering the local undo stack).

```text
Remote action arrives via Yjs observer
  -> Collaboration middleware deserializes
  -> Dispatch through CommandBus starting at Validator
  -> Validator (must pass, same as local)
  -> Collaboration middleware (no-op for incoming, avoids re-sync loop)
  -> Handler
  -> State updates
```

Rules:

1. Remote actions bypass Logger to avoid duplicate log entries.
2. Remote actions bypass Undo/History middleware; they do not enter the local undo stack.
3. Remote actions go through Validator normally.
4. Remote actions go through Handler normally.
5. The Collaboration middleware is a no-op for incoming remote actions to prevent infinite re-sync loops.

### 5.4 Serialization Contract

All actions must round-trip through JSON without data loss.

```ts
interface SerializedDocumentAction {
  actorId: string
  timestamp: number
  action: DocumentAction  // JSON-serialized
}

interface SerializedRuntimeAction {
  actorId: string
  timestamp: number
  pageId: PageId
  action: RuntimeAction  // JSON-serialized
}
```

Rules:

1. `timestamp` is the originating peer's monotonic clock at commit time.
2. `actorId` is a unique identifier assigned per editor session.
3. `pageId` on scene actions identifies which page scene the action targets.

## 6. Conflict Convergence

### 6.1 Action-Level CRDT

Yjs Y.Array handles insertion ordering conflicts automatically. Because the engine uses an append-only action log (never mutates existing entries), the convergence strategy is simple:

```text
Peer A: [...actions, A1, A2]
Peer B: [...actions, B1, B2]

After sync:
Both:   [...actions, ..., ..., ..., ...]  (deterministic merge order)
```

Rules:

1. Action ordering within Y.Array is eventually consistent across all peers.
2. The exact interleaving order of concurrent actions is deterministic (Yjs CRDT guarantees).
3. Any valid interleaving produces a valid final state because each action is atomic and valid on its own.

### 6.2 Semantic Conflicts

Some action combinations may be semantically conflicting even if structurally valid.

| Conflict | Resolution |
|------|------|
| Two peers rename the same page concurrently | Last-writer-wins; both renames are valid actions; the later timestamp wins |
| Two peers delete different nodes in the same scene | Both deletes apply; no conflict (nodes are independent) |
| Two peers move the same node to different parents | Both actions apply in order; the later action wins |
| Two peers update the same node's layout concurrently | Both actions apply; later values overwrite |
| Peer A creates a page, Peer B deletes it concurrently | Yjs CRDT determines a deterministic ordering. If `create-page` precedes `remove-page`, the page is created then removed. If `remove-page` precedes `create-page`, the delete removes any existing page with that ID, then the create restores the full page+scene payload. The final state is the same across all peers. |

### 6.3 Convergence Guarantee

1. All peers that have applied the same set of actions will have identical document and scene state.
2. The order of action application is deterministic across all peers.
3. Any action ordering that Yjs produces is a valid ordering under the engine's action model.

## 7. Presence

### 7.1 Awareness Protocol

Yjs awareness carries ephemeral collaboration state.

```ts
interface AwarenessState {
  user: {
    id: string
    name: string
    color: string
  }
  cursor?: { x: number; y: number; pageId: PageId }
  selection?: { nodeIds: NodeId[]; pageId: PageId }
  viewport?: { zoom: number; x: number; y: number; pageId: PageId }
}
```

Rules:

1. Awareness state is not persisted, not included in event logs, and not replayed.
2. Presence updates are best-effort and may be throttled (default 50 ms interval).
3. A peer that disconnects has its awareness state cleaned up after a configurable timeout.

### 7.2 Presence And Editor Rendering

1. Remote cursors are rendered as colored carets overlaying the canvas.
2. Remote selections are rendered as colored bounding boxes.
3. Remote viewport hints are optional and may be shown in a minimap.
4. Presence rendering must not block or delay action dispatch.

## 8. Connection Lifecycle

### 8.1 Join Session

```text
1. Editor opens a document
2. Collaboration provider connects to the signaling server
3. Y.Doc syncs with existing peers
4. Incoming action log is replayed to catch up
5. Local state is now synchronized
6. Editor is ready for collaborative editing
7. Undo stacks are initialized per `history-and-undo-redo.md` §9: if the session `actorId` is new, undo stacks start empty; if reconnecting with the same `actorId`, only locally-owned actions are restored
```

### 8.2 Leave Session

```text
1. Editor closes the document
2. Local awareness state is cleared
3. Collaboration provider disconnects
4. Pending outgoing actions are flushed before disconnect
5. Session terminates
```

### 8.3 Reconnection

1. On reconnect, Yjs automatically syncs missed actions.
2. The local peer replays missed actions through the CommandBus.
3. If the local peer had pending outgoing actions before disconnect, those are re-sent after sync.
4. After re-sync, the local undo stack is preserved (it contains only the user's own actions, which are unaffected by missed remote actions).

## 9. Transport Provider

Yjs is transport-agnostic. The MVP uses a WebSocket provider.

```ts
import { WebsocketProvider } from 'y-websocket'

const provider = new WebsocketProvider(
  'wss://collab.example.com',
  documentId,
  ydoc
)
```

Rules:

1. The WebSocket server is a simple relay; Yjs CRDT logic runs client-side.
2. The server does not need to understand action semantics.
3. The provider URL and authentication token are configured per deployment.
4. For development, `y-webrtc` may be used as a zero-infrastructure alternative.

## 10. Offline Support

Yjs inherently supports offline editing.

1. Actions committed while offline are held locally in the Y.Doc.
2. On reconnect, Yjs syncs pending actions to peers.
3. Conflict resolution during sync is identical to online concurrent editing.
4. The local undo stack is preserved across offline/online transitions.

## 11. Testing Contract

See `testing-and-fixtures.md` for the collaboration test suite. Key scenarios:

1. Convergent node creation from two peers.
2. Convergent node removal from two peers.
3. Deterministic merge of conflicting layout updates.
4. Remote actions do not enter local undo stack.
5. Awareness state propagation and cleanup on disconnect.
6. Offline action queue and re-sync.

## 12. Relationship To Other Specs

- `domain-model.md`: `PageId`, `VisualDocument`, core types
- `ADR-005-collaboration-transport-strategy.md`: architectural decision rationalizing Yjs/OT as transport
- `runtime-engine.md`: `RuntimeAction`, collaboration middleware
- `document-runtime.md`: `DocumentAction`, document-level collaboration
- `history-and-undo-redo.md`: actor-local undo, remote-action behavior
- `editor-interaction.md`: presence rendering, collaborative undo policy
- `roadmap.md`: Phase 5 collaboration deliverables
