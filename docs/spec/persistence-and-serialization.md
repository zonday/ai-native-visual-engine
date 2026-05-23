# Persistence And Serialization

## 1. Scope

This document defines the persistence model, serialization format, snapshot strategy, and event log truncation policy for the engine.

## 2. Persistence Architecture

The engine persists two independent event streams plus periodic snapshots.

```text
Document persistence:
  DocumentSnapshot (full) + DocumentEventLog (incremental)

Scene persistence:
  PersistedSceneGraph (in snapshot) + SceneEventLog (incremental)
```

Rules:

1. The document snapshot is the authoritative persisted form.
2. Event logs append new actions without mutating the snapshot.
3. Snapshots are rebuilt from event logs during compaction.

## 3. Serialization Format

### 3.1 Canonical Format

The engine uses JSON as the canonical serialization format.

```ts
export interface SerializedDocument {
  version: number
  type: 'document-snapshot'
  timestamp: number
  payload: DocumentSnapshot
}
```

```ts
export interface SerializedEventLog {
  version: number
  type: 'event-log'
  context: 'document' | 'scene'
  contextId: string
  checkpointHash: string
  actions: DocumentAction[] | RuntimeAction[]
}
```

Rules:

1. All serialized payloads carry a schema `version` and `timestamp`.
2. `checkpointHash` references the snapshot from which the event log was built.
3. Session-only actions such as `update-selection` must never appear in serialized event logs.

### 3.2 Versioning

```ts
export const CURRENT_SERIALIZATION_VERSION = 1
```

Forward compatibility:

1. Unknown fields in a newer schema version must be preserved on round-trip.
2. The engine must validate the schema version before deserialization.
3. A migration path must be provided when the schema version changes.

## 4. Snapshot Strategy

The engine maintains periodic full snapshots to bound replay cost.

### 4.1 Snapshot Frequency

Rules:

1. A snapshot is written after every `N` committed durable actions, where `N` is configurable (default 100).
2. A snapshot is written immediately before document close.
3. Snapshots are written asynchronously and must not block action dispatch.

### 4.2 Snapshot Verification

```ts
export interface SnapshotVerification {
  snapshot: DocumentSnapshot
  logActions: number
  logMatchesReplay: boolean
}
```

Rules:

1. After writing a snapshot, the engine may optionally verify it by replaying the remaining event log.
2. If verification fails, the engine must surface a diagnostic and fall back to the previous verified snapshot.

## 5. Event Log Truncation

To prevent unbounded growth, event logs are truncated after verified snapshots.

### 5.1 Truncation Policy

```text
Before truncation:
  [Snapshot at seq N] + [Actions N+1 ... M]

After truncation:
  [Snapshot at seq M] + [Actions from M+1 ...]
```

Rules:

1. Truncation removes actions that are fully represented by a verified snapshot.
2. Truncation must not remove actions that have not yet been checkpointed.
3. Truncation is a background operation and must not block action dispatch.
4. Post-truncation, undo history for truncated actions is preserved in the snapshot state, not the event log.

### 5.2 Action Count Bounds

1. Document event log: maximum 1000 actions before compaction is required.
2. Scene event log per page: maximum 500 actions before compaction is required.
3. These bounds are configurable and may be tuned per deployment.

## 6. Storage Backend

The engine is storage-backend agnostic. The persistence layer exposes a simple interface.

```ts
export interface StorageBackend {
  loadDocument(documentId: DocumentId): Promise<DocumentSnapshot | null>
  saveDocument(snapshot: DocumentSnapshot): Promise<void>
  appendEventLog(
    context: 'document' | 'scene',
    contextId: string,
    actions: DocumentAction[] | RuntimeAction[]
  ): Promise<void>
  loadEventLog(
    context: 'document' | 'scene',
    contextId: string,
    sinceVersion?: number
  ): Promise<DocumentAction[] | RuntimeAction[]>
  compact(documentId: DocumentId): Promise<void>
}
```

Rules:

1. The storage backend is a pluggable interface.
2. The MVP may use an in-memory implementation for development.
3. Production backends must be transactional for snapshot-plus-event-log writes.

## 7. Document Reconstruction

To load a document from persistence:

```text
1. Load latest DocumentSnapshot
2. Load DocumentEventLog since snapshot checkpoint
3. Replay document actions onto snapshot
4. For each page scene:
   a. Load PersistedSceneGraph from snapshot
   b. Load SceneEventLog since scene checkpoint
   c. Replay scene actions onto persisted scene
5. Materialize into in-memory SceneGraph instances
6. Document is ready for editing
```

Rules:

1. Reconstruction must be deterministic.
2. If any step fails, the engine must surface diagnostics and attempt partial recovery.
3. Damaged pages must not block reconstruction of healthy pages.

## 8. Import And Export Serialization

### 8.1 Export Format

Export produces a self-contained `DocumentSnapshot` without event logs.

```text
Export = DocumentSnapshot (full state, no incremental log)
```

### 8.2 Import Format

Import accepts a `DocumentSnapshot` and produces a new document with a fresh event log.

```text
Import = DocumentSnapshot -> Validate -> New DocumentId -> Fresh EventLog
```

The imported document starts with a single checkpoint action in both event logs.

## 9. Relationship To Other Specs

- `domain-model.md`: `DocumentSnapshot`, `PersistedSceneGraph`, `VisualDocument`
- `runtime-engine.md`: `SceneEventLog`, event sourcing model
- `document-runtime.md`: `DocumentEventLog`, document history
- `bootstrap-and-lifecycle.md`: document initialization and load sequence
