# History And Undo Redo

## 1. Scope

This document defines the unified undo/redo model, history recording, inverse-action contracts, and the interaction between history and collaboration across both document and scene runtime domains.

## 2. History Architecture

The engine maintains two independent history domains of the same shape.

```text
Document history:
  DocumentHistoryState { undoStack, redoStack }

Scene history (per page):
  HistoryState { undoStack, redoStack }
```

Both use the same entry structure:

```ts
export interface HistoryEntry<TAction> {
  action: TAction
  inverseAction?: TAction
  timestamp: number
  actorId?: string
}

export interface HistoryState<TAction> {
  undoStack: HistoryEntry<TAction>[]
  redoStack: HistoryEntry<TAction>[]
}
```

Rules:

1. Document history contains only `DocumentAction` entries.
2. Scene history contains only `RuntimeAction` entries.
3. The two histories do not merge; they remain separate execution domains.
4. History state is in-memory during an editing session and is rebuilt from event logs on document load.

## 3. Inverse Action Contract

Every durable action must be reversable. The engine records the `inverseAction` in the history entry.

```ts
export function computeInverseAction(
  state: VisualDocument | SceneGraph,
  action: DocumentAction | RuntimeAction,
  context: RuntimeContext | DocumentRuntimeContext
): DocumentAction | RuntimeAction | undefined
```

### 3.1 Inverse Action Requirements

1. An inverse action must be a valid action of the same domain (document or runtime).
2. Replaying `action` followed by `inverseAction` on the same state must restore the original state.
3. If an action's inverse cannot be represented compactly, the history entry may store a structural patch instead.

### 3.2 Inverse Action Examples

| Forward Action | Inverse Action |
|------|------|
| `create-node` with node `N` and parent `P` at index `i` | `remove-node` with node `N.id` |
| `remove-node` with node `N` | `create-node` with saved `N` snapshot and saved parent/index |
| `move-node` from parent `P1` index `i1` to `P2` index `i2` | `move-node` back to `P1` at index `i1` |
| `update-layout` changing `x` from 10 to 20 | `update-layout` setting `x` back to 10 |
| `rotate-node` changing rotation from 45 to 90 | `rotate-node` setting rotation back to 45 |
| `update-props` shallow merging `{color: 'red'}` | `update-props` restoring pre-merge keys or storing a diff |
| `update-style` with new style object | `update-style` restoring the previous style object |
| `update-bindings` replacing bindings | `update-bindings` restoring the previous bindings array |
| `update-runtime` shallow merging runtime state | `update-runtime` restoring pre-merge runtime state |
| `batch-actions` with `[A1, A2, A3]` | `batch-actions` with `[inv_A3, inv_A2, inv_A1]` |
| `create-page` | `remove-page` with the created `pageId` |
| `remove-page` | `create-page` with saved `Page` and `PersistedSceneGraph` snapshot |
| `reorder-page` from index `a` to `b` | `reorder-page` back to index `a` |
| `set-document-theme` from `T1` to `T2` | `set-document-theme` back to `T1` (or clear if `T1` was empty) |
| `set-page-theme` from `T1` to `T2` | `set-page-theme` back to `T1` (or clear if `T1` was empty) |

### 3.3 Snapshot Fallback

For actions whose inverse cannot be computed compactly:

1. The history middleware may store a state snapshot diff in the history entry.
2. Undo applies the snapshot diff rather than replaying a computed inverse action.
3. Snapshot-diff-based undo must be structurally equivalent to inverse-action replay.

## 4. Undo Redo Lifecycle

### 4.1 Standard Undo Redo Cycle

```text
State S0
  -> commit action A1 -> S1 + push {A1, inv_A1} onto undoStack
  -> commit action A2 -> S2 + push {A2, inv_A2} onto undoStack, clear redoStack
  -> undo                -> inv_A2 applied to S2 -> S1' + pop undoStack, push onto redoStack
  -> redo                -> A2 applied to S1'   -> S2' + pop redoStack, push onto undoStack
```

Rules:

1. Each committed durable action produces exactly one history entry.
2. The `undoStack` is a LIFO queue of committed actions.
3. When a new forward action is committed, the `redoStack` is cleared.
4. Undo pops the top entry from `undoStack`, applies `inverseAction`, and pushes onto `redoStack`.
5. Redo pops the top entry from `redoStack`, applies `action`, and pushes onto `undoStack`.
6. Batch actions produce a single history entry; undo/redo treats them atomically.

### 4.2 Focus Scoped Undo Redo

In the MVP, undo and redo are scoped by the user's current interaction focus.

```text
When focus is in the page list panel:
  undo/redo operates on document history

When focus is in the canvas:
  undo/redo operates on scene history for the active page
```

Rules:

1. The editor must route undo and redo to the correct history domain based on focus.
2. A page-level undo does not affect the document-level undo stack.
3. A document-level undo does not affect any page's scene-level undo stack.
4. If the undo operation crosses a page-lifecycle action (e.g., undoing a `create-page`), the editor must handle the page deactivation cleanly.

### 4.3 Page Scene History Lifecycle

When a page is deleted, its scene undo/redo stacks are also discarded.

1. On local `remove-page`, the scene history for that page is discarded immediately.
2. If the `remove-page` is undone, the scene history is re-created empty (the restored scene state is reconstructed from the event log and snapshot, not from the discarded undo stack).
3. On remote `remove-page`, the local scene undo/redo stacks for the deleted page are discarded.
4. A page that is recreated (whether through undo or a new `create-page`) starts with empty scene undo/redo stacks.
5. If a page undo operation targets a page that no longer exists (deleted remotely), the undo degrades to a no-op as described in §7.3.

## 5. Undo Stack Bounds

To prevent unbounded memory growth:

1. Document history: maximum 200 entries per session.
2. Scene history per page: maximum 200 entries per session.
3. When a stack exceeds the maximum, the oldest entries are evicted.
4. Evicted entries are no longer reachable by undo but remain in the event log for replay.

```ts
export const DEFAULT_MAX_UNDO_STACK = 200
```

## 6. History Middleware

The undo/redo lifecycle is implemented as middleware in both the document and scene runtime pipelines.

```text
Action dispatch
  -> Logger
  -> Validator
  -> Undo/History middleware (this section)
  -> Collaboration middleware
  -> Handler
```

Undo/History middleware responsibilities:

1. Compute `inverseAction` or snapshot diff on successful commit.
2. Push a `HistoryEntry` onto the `undoStack`.
3. Clear the `redoStack`.
4. Evict oldest entries if stack size exceeds `DEFAULT_MAX_UNDO_STACK`.
5. Emit a history-changed event for the editor to update UI state.

```ts
export interface HistoryMiddlewareConfig {
  maxStackSize: number
  computeInverse: typeof computeInverseAction
}
```

## 7. History And Collaboration Interaction

### 7.1 Local And Remote Action Handling

```text
Local user commits action:
  -> push onto local undoStack

Remote action arrives via collaboration:
  -> apply to local state
  -> do NOT push onto local undoStack
```

Rules:

1. Only locally-initiated durable actions enter the local undo stack.
2. Remote durable actions are applied to the local scene/document without entering local history.
3. Remote actions clear the local redo stack because the state context has changed.
4. Remote inverse of a local action (e.g., another user undoing their own change) does not enter the local undo stack.

### 7.2 Undo After Remote Update

If a remote update arrives while the user has a non-empty undo stack:

```text
State S0
  -> local commit A1 -> S1, undoStack = [A1]
  -> remote commit R1 -> S2
  -> user presses undo -> inv_A1 applied to S2 -> S2'
```

Rules:

1. Local undo still applies the inverse of the user's own action.
2. The inverse action is applied to the current state, which includes remote changes.
3. If the inverse action references state that was modified by a remote action, the handler must apply the inverse to the current state. If the inverse is no longer semantically meaningful (e.g., undoing a `remove-node` when the node was already removed remotely), the undo must degrade gracefully: either become a no-op that still pops the stack, or surface a diagnostic.

### 7.3 Conflict During Undo

When undoing an action whose target was also modified remotely:

| Scenario | Behavior |
|------|------|
| Undo `update-layout` on node already moved remotely | Undo applies the inverse layout values to the current state; remote position is preserved |
| Undo `remove-node` on node already removed remotely | No-op; pop the stack without applying an inverse |
| Undo `create-node` on node that still exists | Remove the node if it still exists; skip if already removed |
| Undo `create-page` on page that remote modified | Remove the page record and its scene if the page exists; collapse to no-op if already removed |

### 7.4 Actor Identification

Every history entry records the `actorId` so that collaborative undo policies can distinguish local from remote actions.

```ts
export interface HistoryEntry<TAction> {
  action: TAction
  inverseAction?: TAction
  timestamp: number
  actorId?: string
}
```

Rules:

1. `actorId` is set by the editor session on local commits.
2. Remote actions carry their originating `actorId`.
3. Undo middleware compares `actorId` against the current session to enforce actor-local undo.

### 7.5 Presence And Undo

Undo and redo do not affect presence state.

1. Cursor position, remote selection outlines, and viewport hints are not affected by undo/redo.
2. After an undo, the editor may reselect the affected nodes as a convenience, but this is a UI concern, not a history concern.

## 8. Post-MVP: Merged Activity Timeline

Future versions may add a merged activity timeline that interleaves document and scene history entries for inspection.

```ts
export interface ActivityEntry {
  timestamp: number
  domain: 'document' | 'scene'
  pageId?: PageId
  action: DocumentAction | RuntimeAction
  actorId?: string
}

export type ActivityTimeline = ActivityEntry[]
```

Rules for the merged timeline:

1. The timeline is read-only for browsing and audit.
2. It does not support merged undo/redo across domains.
3. Primary undo and redo remain focus-scoped to document or scene history.
4. The timeline is reconstructed from event logs on demand; it is not a separate persistence stream.

## 9. History Replay And State Reconstruction

History entries are derived from event logs during document load.

```text
On document load:
  1. Load DocumentSnapshot
  2. Load DocumentEventLog since checkpoint
  3. Replay document actions -> build document state + document history
  4. For each page:
     a. Load PersistedSceneGraph
     b. Load SceneEventLog since checkpoint
     c. Replay scene actions -> build scene state + scene history
```

Rules:

1. Identity of local vs remote actions is preserved during replay via `actorId`.
2. After replay, the local undo stack contains only actions whose `actorId` matches the current session.
3. Remote actions in the replayed event log do not enter the local undo stack.
4. If the local session's `actorId` is unknown during replay (e.g., a new session opening an existing document), the undo stack starts empty.

## 10. Testing Contract

See `testing-and-fixtures.md` for the undo/redo test suite. Key test scenarios:

1. Every durable action type produces a valid `inverseAction`.
2. Undo + redo round-trip for every action type.
3. Batch actions undo/redo atomically.
4. Session-only actions do not produce history entries.
5. Remote actions do not enter local undo stack.
6. Cross-page undo does not leak between page scenes.
7. Undo after concurrent remote update behaves deterministically.

## 11. Relationship To Other Specs

- `domain-model.md`: `Page`, `SceneGraph`, `VisualDocument`, core types
- `runtime-engine.md`: `HistoryState`, `HistoryEntry`, undo middleware, scene history rules
- `document-runtime.md`: `DocumentHistoryState`, `DocumentHistoryEntry`, document history rules
- `editor-interaction.md`: collaborative undo policy, focus-scoped undo
- `persistence-and-serialization.md`: event log replay, history reconstruction from logs
- `testing-and-fixtures.md`: undo/redo test contracts
