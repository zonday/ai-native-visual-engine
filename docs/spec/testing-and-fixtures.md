# Testing And Fixtures

## 1. Scope

This document defines the testing strategy for the engine, including fixture scene requirements, replay testing, and expected test categories per delivery phase.

## 2. Fixture Strategy

Fixtures are pre-built document snapshots used for regression testing. They must be stable, versioned, and replayable.

### 2.1 Fixture Scene Requirements

A valid fixture scene must satisfy:

1. A complete `DocumentSnapshot` with at least one page.
2. The document must pass schema and structural validation.
3. Every `SceneNode.type` referenced in the fixture must be resolvable by a registered plugin in the test environment.
4. Fixture scenes must not depend on runtime-only state such as active selection or viewport.

### 2.2 Fixture Location And Format

```text
src/core/__fixtures__/
  single-page-empty.json
  multi-page-dashboard.json
  grid-layout-sample.json
  absolute-layout-sample.json
  unknown-plugin-node.json
  invalid-geometry-node.json
  theme-multi-page.json
```

Rules:

1. Fixtures are stored as JSON-serialized `DocumentSnapshot` objects.
2. Each fixture file represents one `DocumentSnapshot`.
3. Fixtures are committed to the repository and treated as source of truth for regression.
4. Invalid-geometry fixtures are explicitly tagged for negative testing.

### 2.3 Fixture Validation

Each fixture must pass a validation pass before use in tests:

```ts
export function validateFixture(snapshot: DocumentSnapshot): ValidationResult
```

1. Schema validation must pass for all valid fixture files.
2. Negative-test fixtures must produce specific expected diagnostics.
3. Validation runs as part of CI before any test suite that consumes fixtures.

## 3. Test Categories

### 3.1 Action Replay Tests

Purpose: Confirm that deterministic action sequences always produce the same final state.

```ts
describe('action replay', () => {
  it('reproduces the same scene from the same action log')
  it('reproduces the same document from the same document action log')
  it('replay is independent of execution environment')
})
```

Acceptance:

1. Given a fixture `DocumentSnapshot` and an ordered action log, replaying the log always produces the same target snapshot.
2. Replay across different runtime instances must be deterministic.

### 3.2 Undo And Redo Tests

Purpose: Confirm that every durable action can be undone and redone.

```ts
describe('undo and redo', () => {
  it('undo restores pre-action state')
  it('redo restores committed state after undo')
  it('batch actions undo and redo as a single unit')
  it('session-only actions do not enter durable undo stack')
})
```

### 3.3 Validation Tests

Purpose: Confirm that invalid inputs are rejected predictably.

```ts
describe('validation', () => {
  it('rejects create-node with duplicate id')
  it('rejects remove-node on root')
  it('rejects move-node that creates a cycle')
  it('rejects update-layout with invalid geometry')
  it('rejects rotate-node on non-absolute layout')
  it('rejects set-document-theme with unknown theme id')
  it('rejects create-page with duplicate page id')
  it('rejects create-page with duplicate scene id')
  it('rejects create-page with duplicate route')
})
```

### 3.4 Compiler Tests

Purpose: Confirm that semantic actions compile into valid execution plans.

```ts
describe('semantic compiler', () => {
  it('create-dashboard produces a valid execution plan')
  it('insert-chart targets a valid container')
  it('invalid semantic request produces actionable diagnostics')
  it('theme intent compiles into document actions')
})
```

### 3.5 Collaboration Convergence Tests

Purpose: Confirm that concurrent edits converge deterministically.

#### Strategy

Collaboration tests simulate two or more peer sessions operating on the same document. Because Yjs CRDT logic runs client-side, no real network is needed — tests create multiple in-memory Yjs Y.Doc instances connected through a virtual sync channel.

```ts
import { Doc } from 'yjs'

function createPeerPair() {
  const docA = new Doc()
  const docB = new Doc()

  // Mirror updates bidirectionally to simulate sync
  docA.on('update', (update: Uint8Array) => {
    Y.applyUpdate(docB, update)
  })
  docB.on('update', (update: Uint8Array) => {
    Y.applyUpdate(docA, update)
  })

  return { docA, docB }
}
```

#### Test Scenarios

```ts
describe('collaboration convergence', () => {
  it('concurrent node creation produces identical scenes on both peers', () => {
    const { docA, docB } = createPeerPair()

    dispatchToDoc(docA, createNodeAction('a', rootId))
    dispatchToDoc(docB, createNodeAction('b', rootId))

    // After sync, both peers have two nodes
    expect(getNodeIds(docA)).toEqual(expect.arrayContaining(['a', 'b']))
    expect(getNodeIds(docB)).toEqual(expect.arrayContaining(['a', 'b']))
    expect(getNodeIds(docA)).toEqual(getNodeIds(docB))
  })

  it('concurrent layout updates converge to deterministic final state', () => {
    const { docA, docB } = createPeerPair()

    dispatchToDoc(docA, updateLayoutAction(nodeId, { x: 10 }))
    dispatchToDoc(docB, updateLayoutAction(nodeId, { y: 20 }))

    // CRDT determines ordering; both peers agree
    const layoutA = getLayout(docA, nodeId)
    const layoutB = getLayout(docB, nodeId)
    expect(layoutA).toEqual(layoutB)
  })

  it('remote action does not enter local undo stack', () => {
    const { docA, docB } = createPeerPair()

    // Peer B creates a node
    const action = createNodeAction('remote-node', rootId)
    dispatchToDoc(docB, action)

    // Peer A receives the remote action
    syncAll(docA, docB)

    // Peer A's undo stack must not contain the remote action
    expect(getUndoStack(docA)).toHaveLength(0)
  })

  it('remote action clears local redo stack', () => {
    const { docA, docB } = createPeerPair()

    // Peer A commits and undoes to populate redo stack
    dispatchToDoc(docA, updateLayoutAction(nodeId, { x: 10 }))
    undo(docA)
    expect(getRedoStack(docA)).toHaveLength(1)

    // Peer B commits; sync reaches Peer A
    dispatchToDoc(docB, updateLayoutAction(nodeId, { y: 20 }))
    syncAll(docA, docB)

    // Peer A's redo stack must be cleared
    expect(getRedoStack(docA)).toHaveLength(0)
  })

  it('concurrent node removal converges', () => {
    const { docA, docB } = createPeerPair()

    dispatchToDoc(docA, removeNodeAction(nodeId))
    dispatchToDoc(docB, removeNodeAction(nodeId))

    syncAll(docA, docB)

    // Node is gone on both peers
    expect(nodeExists(docA, nodeId)).toBe(false)
    expect(nodeExists(docB, nodeId)).toBe(false)
  })

  it('offline actions are queued and synced on reconnect', () => {
    const { docA, docB } = createPeerPair()

    // Disconnect Peer B
    disconnect(docA, docB)

    dispatchToDoc(docB, createNodeAction('offline-node', rootId))

    // Peer A does not yet see the action
    expect(nodeExists(docA, 'offline-node')).toBe(false)

    // Reconnect
    connect(docA, docB)

    // Peer A now has the queued action
    expect(nodeExists(docA, 'offline-node')).toBe(true)
  })

  it('presence state propagates between peers', () => {
    const { docA, docB } = createPeerPair()

    setPresence(docA, { cursor: { x: 100, y: 200, pageId: 'p1' } })
    setPresence(docB, { cursor: { x: 300, y: 400, pageId: 'p1' } })

    expect(getPresence(docA, 'peerB').cursor).toEqual({ x: 300, y: 400 })
    expect(getPresence(docB, 'peerA').cursor).toEqual({ x: 100, y: 200 })
  })

  it('presence is cleaned up on disconnect', () => {
    const { docA, docB } = createPeerPair()

    setPresence(docB, { cursor: { x: 0, y: 0 } })
    disconnect(docA, docB)

    // Peer A must clean up Peer B's presence after timeout
    expect(getPresence(docA, 'peerB')).toBeUndefined()
  })
})
```

#### Test Helpers

Each collaboration test suite must provide these helpers:

```ts
// Dispatch an action through a peer's collaboration pipeline
function dispatchToDoc(doc: Doc, action: RuntimeAction | DocumentAction): void

// Bidirectional sync between two docs
function syncAll(docA: Doc, docB: Doc): void

// Disconnect / reconnect the update mirror between two docs
function disconnect(docA: Doc, docB: Doc): void
function connect(docA: Doc, docB: Doc): void

// Presence helpers
function setPresence(doc: Doc, state: AwarenessState): void
function getPresence(doc: Doc, peerId: string): AwarenessState | undefined

// Scene query helpers
function getNodeIds(doc: Doc): NodeId[]
function getLayout(doc: Doc, nodeId: NodeId): Layout | undefined
function nodeExists(doc: Doc, nodeId: NodeId): boolean
function getUndoStack(doc: Doc): HistoryEntry[]
function getRedoStack(doc: Doc): HistoryEntry[]
function undo(doc: Doc): void
```

## 4. Phase Scoped Test Requirements

### Phase 1: Core Document And Scene Runtime

1. Action replay tests on 3 fixture scenes (single-page, multi-page, empty).
2. Undo and redo tests for all document and runtime actions.
3. Validation rejection tests for all action types.
4. Document initialization and session lifecycle tests.

### Phase 2: Layout And Editor Basics

1. Layout rejection tests for invalid geometry.
2. Selection system tests.
3. Move and resize interaction tests.
4. Rotate-node tests with valid and invalid preconditions.

### Phase 3: Semantic Compiler

1. Compiler output contract tests.
2. Semantic-action-to-execution-plan tests.
3. Compiler diagnostic tests for invalid semantic requests.

### Phase 4: AI Integration And Constraints

1. Constraint validation pipeline tests.
2. AI tool-call to semantic action conversion tests.
3. Auto-layout strategy tests.

### Phase 5: Collaboration

1. Action sync convergence tests.
2. Presence state tests.
3. Collaborative undo policy tests.

## 5. Test Environment Requirements

1. Tests must run without a browser DOM for core logic.
2. Renderer tests may require a DOM environment.
3. Fixture loading must be synchronous and deterministic.
4. Test runs must be reproducible in CI.

## 6. Relationship To Other Specs

- `domain-model.md`: `DocumentSnapshot`, `PersistedSceneGraph`
- `runtime-engine.md`: `RuntimeAction`, `SceneEventLog`, handler contracts
- `document-runtime.md`: `DocumentAction`, `DocumentEventLog`
- `semantic-system.md`: compiler contracts and diagnostics
- `roadmap.md`: phase-scoped delivery criteria
