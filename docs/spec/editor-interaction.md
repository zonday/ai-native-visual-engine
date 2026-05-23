# Editor Interaction Model

## 1. Scope

This document defines user-facing editing capabilities and how they map to runtime actions and session state.

## 2. Selection System

Selection is modeled on the scene as:

```ts
export interface SelectionState {
  nodeIds: NodeId[]
}
```

Rules:

1. Selection order should be stable and reflect selection sequence when meaningful.
2. Empty selection is valid.
3. Locked nodes may be selectable but not transformable, depending on product policy.
4. Local selection is session-scoped editor state and is not persisted into `DocumentSnapshot` by default.
5. Remote user selection is modeled as presence state, not as durable shared document state.

Supported behaviors:

1. single select
2. multi select
3. marquee select
4. select parent
5. select children through layers panel

## 3. Transform Controls

The editor must support:

1. move
2. resize
3. rotate

These interactions are UI gestures that compile into runtime actions.

Rules:

1. During drag, temporary preview state may live in session state.
2. On commit, final geometry must be written via runtime actions.
3. Transform rules depend on layout mode and component capability.
4. Rotation is stored on canonical layout fields such as `AbsoluteLayout.rotation` and committed through `rotate-node`.

Examples:

1. resizing a grid item -> `update-layout` with `w/h`
2. moving a grid widget -> `update-layout` with `x/y`
3. moving a node to another container -> `move-node`
4. absolute canvas drag -> `update-layout` with pixel coordinates
5. rotating an absolute node -> `rotate-node`

## 4. Drag and Drop Semantics

Drag and drop has two phases:

1. preview phase
2. commit phase

Preview phase:

- computes insertion target
- displays ghost indicator
- does not mutate persisted scene

Commit phase:

- dispatches one or more runtime actions
- creates one history entry

## 5. Multi Page Editing

The editor must support:

1. page create
2. page rename
3. page delete
4. page reorder
5. route editing
6. per-page scene editing

Document-level operations are modeled separately from scene runtime actions and use the execution model defined in `document-runtime.md`.

Recommended document actions:

```ts
export type DocumentAction =
  | { type: 'create-page'; page: Page; scene: PersistedSceneGraph }
  | { type: 'rename-page'; pageId: PageId; name: string }
  | { type: 'remove-page'; pageId: PageId }
  | { type: 'reorder-page'; pageId: PageId; index: number }
  | { type: 'update-page-route'; pageId: PageId; route: string }
```

`DocumentAction` and `RuntimeAction` should share infrastructure patterns but remain separate execution domains with separate event logs.

Execution rules:

1. page creation must create the page record and its persisted scene atomically
2. page deletion must remove the page record and its persisted scene atomically
3. semantic compiler output may include document actions followed by scene runtime actions
4. document actions operate on persisted scene payloads only and must not carry session overlays such as `selection` or `viewport`

## 6. Collaboration

Collaboration requirements:

1. concurrent edits should converge
2. remote actions must map into the same runtime model
3. selection presence and cursors may be ephemeral and not persisted
4. undo and redo operate on the current actor's durable actions only

Recommended split:

1. persistent shared state -> document actions and scene runtime actions
2. presence state -> cursor, viewport hint, selected node outline, user color

Yjs or OT integration should wrap action transport rather than replacing the action model.

Undo policy:

1. local users undo their own durable document and scene actions only
2. remote durable actions do not enter the local undo stack
3. selection, viewport, and presence changes do not participate in durable collaborative undo

## 7. Session State vs Persistent State

Persistent:

- page ordering
- document theme selection
- page theme overrides
- node tree
- props
- layout
- visibility
- page definitions

Session only:

- selection
- viewport offset and zoom
- hover state
- active panel tab
- drag preview rectangle
- current pointer position
- remote presence overlay cache

## 8. Runtime Renderer Modes

The editor should support at least two rendering contexts:

1. editor mode
2. runtime preview mode

Differences:

1. editor mode shows overlays, handles, selection chrome
2. runtime mode shows production-like rendering
3. both modes must consume the same underlying scene graph

## 9. Interaction Acceptance Rules

An editing interaction is considered engine-compliant only if:

1. final committed state is representable through actions
2. undo restores previous state correctly
3. redo restores committed state correctly
4. collaboration can broadcast the committed result
5. renderer switch does not change the underlying scene meaning
6. session-only state such as selection and presence does not leak into durable document persistence unless explicitly opted in
7. invalid geometry is blocked at commit time rather than silently repaired by the runtime
