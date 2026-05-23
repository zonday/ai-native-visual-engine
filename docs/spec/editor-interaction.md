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

1. Single select.
2. Multi select.
3. Marquee select.
4. Select parent.
5. Select children through layers panel.

## 3. Transform Controls

The editor must support:

1. Move.
2. Resize.
3. Rotate.

These interactions are UI gestures that compile into runtime actions.

Rules:

1. During drag, temporary preview state may live in session state.
2. On commit, final geometry must be written via runtime actions.
3. Transform rules depend on layout mode and component capability.
4. Rotation is stored on canonical layout fields such as `AbsoluteLayout.rotation` and committed through `rotate-node`.

Examples:

1. Resizing a grid item -> `update-layout` with `w/h`.
2. Moving a grid widget -> `update-layout` with `x/y`.
3. Moving a node to another container -> `move-node`.
4. Absolute canvas drag -> `update-layout` with pixel coordinates.
5. Rotating an absolute node -> `rotate-node`.

## 4. Drag and Drop Semantics

Drag and drop has two phases:

1. Preview phase.
2. Commit phase.

Preview phase:

- computes insertion target
- displays ghost indicator
- does not mutate persisted scene

Commit phase:

- dispatches one or more runtime actions
- creates one history entry

## 5. Multi Page Editing

The editor must support:

1. Page create.
2. Page rename.
3. Page delete.
4. Page reorder.
5. Route editing.
6. Per-page scene editing.

Document-level operations are modeled separately from scene runtime actions and use the execution model defined in `document-runtime.md`, which defines the authoritative `DocumentAction` union including page lifecycle, theme, and batch actions.

Execution rules:

1. Page creation must create the page record and its persisted scene atomically.
2. Page deletion must remove the page record and its persisted scene atomically.
3. Semantic compiler output may include document actions followed by scene runtime actions.
4. Document actions operate on persisted scene payloads only and must not carry session overlays such as `selection` or `viewport`.

## 6. Collaboration

Collaboration requirements:

1. Concurrent edits should converge.
2. Remote actions must map into the same runtime model.
3. Selection presence and cursors may be ephemeral and not persisted.
4. Undo and redo operate on the current actor's durable actions only.

Recommended split:

1. Persistent shared state -> document actions and scene runtime actions.
2. Presence state -> cursor, viewport hint, selected node outline, user color.

Yjs or OT integration should wrap action transport rather than replacing the action model.

Undo policy:

1. Local users undo their own durable document and scene actions only.
2. Remote durable actions do not enter the local undo stack.
3. Selection, viewport, and presence changes do not participate in durable collaborative undo.
4. Post-MVP UI may add a merged activity timeline for browsing history, but primary undo and redo remain focus-scoped.

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
2. runtime mode

Differences:

1. Editor mode shows overlays, handles, selection chrome.
2. Runtime mode shows production-like rendering.
3. Both modes must consume the same underlying scene graph.

## 9. Interaction Acceptance Rules

An editing interaction is considered engine-compliant only if:

1. Final committed state is representable through actions.
2. Undo restores previous state correctly.
3. Redo restores committed state correctly.
4. Collaboration can broadcast the committed result.
5. Renderer switch does not change the underlying scene meaning.
6. Session-only state such as selection and presence does not leak into durable document persistence unless explicitly opted in.
7. Invalid geometry is blocked at commit time rather than silently repaired by the runtime.
