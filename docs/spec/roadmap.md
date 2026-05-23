# Roadmap And Acceptance

## 1. Delivery Strategy

The engine should be built in phases that preserve a usable internal spine from the first milestone onward.

Each phase must end with:

1. a working demo path
2. explicit acceptance criteria
3. a stable API surface for the next phase

## 2. Phase 1: Core Document And Scene Runtime

Scope:

1. document snapshot model
2. scene graph model
3. document actions for page lifecycle
4. node CRUD runtime actions
5. command buses and handler registries
6. React renderer

Deliverables:

1. create, move, remove, update props, update layout
2. create, rename, reorder, remove, and `update-page-route` page actions
3. scene replay from action log
4. renderer that can render a page from scene graph

Acceptance criteria:

1. a sample multi-page document can be created from document actions plus runtime actions
2. replaying the document and scene event logs rebuilds the same document state
3. renderer reads from scene graph only
4. page route updates pass document validation and replay correctly

## 3. Phase 2: Layout And Editor Basics

Scope:

1. grid layout
2. selection
3. resize
4. move interactions
5. rotate interactions
6. viewport state

Deliverables:

1. grid engine with collision detection
2. selection system and overlays
3. drag move, resize, and `rotate-node` actions

Acceptance criteria:

1. widgets can be selected, moved, resized, and rotated when supported by layout mode and plugin capability
2. undo and redo work for move, resize, and rotate interactions
3. grid layout remains valid after interactions, and invalid rotate requests are rejected deterministically

## 4. Phase 3: Semantic Compiler

Scope:

1. semantic actions
2. compiler pipeline
3. planner
4. AI component metadata

Deliverables:

1. `create-dashboard`
2. `insert-chart`
3. compiler diagnostics
4. AI schema index from plugin metadata

Acceptance criteria:

1. semantic actions compile into document actions and/or runtime actions
2. invalid semantic requests produce diagnostics instead of broken scenes
3. generated dashboards satisfy required semantic constraints

## 5. Phase 4: AI Integration And Constraints

Scope:

1. tool calling integration
2. auto layout
3. constraint engine
4. AI-driven modifications

Deliverables:

1. AI request to semantic action conversion
2. constraint validation pipeline
3. auto-layout strategies

Acceptance criteria:

1. AI can create and modify pages without direct scene mutation
2. invalid AI requests are blocked or degraded safely
3. layout suggestions produce valid runtime actions

## 6. Phase 5: Collaboration

Scope:

1. shared editing
2. presence state
3. conflict convergence
4. multiplayer history behavior

Deliverables:

1. action sync over CRDT or OT
2. remote cursor and selection presence
3. deterministic convergence tests

Acceptance criteria:

1. concurrent edits converge consistently
2. shared scenes remain valid after sync
3. undo policy for collaborative edits is explicitly defined and tested

## 7. Cross Phase Engineering Requirements

Every phase should include:

1. type-safe public contracts
2. schema validation for external inputs
3. fixture scenes for regression testing
4. action replay tests
5. documentation updates

## 8. Suggested Initial Package Breakdown

This is the minimal phase-scoped package breakdown for Phase 1. It intentionally lists only the packages that must exist by the end of that phase.

```text
src/core/document
src/core/scene
src/core/runtime
src/core/layout
src/core/plugins
src/core/compiler
src/renderer/react
src/editor
src/ai
```

## 9. Milestone Demo Scenarios

Recommended demo scenarios:

1. create sample dashboard from runtime actions only
2. drag and resize cards on a grid page
3. invoke `create-dashboard` semantic action and compile it
4. replay action log to reconstruct dashboard
5. simulate two-user collaboration update stream
