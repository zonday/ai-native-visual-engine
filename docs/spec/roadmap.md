# Roadmap And Acceptance

## 1. Delivery Strategy

The engine should be built in phases that preserve a usable internal spine from the first milestone onward.

Each phase must end with:

1. A working demo path.
2. Explicit acceptance criteria.
3. A stable API surface for the next phase.

## 2. Phase 1: Core Document And Scene Runtime

Scope:

1. Document snapshot model.
2. Scene graph model.
3. Document actions for page lifecycle.
4. Node CRUD runtime actions.
5. Command buses and handler registries.
6. React renderer.

Deliverables:

1. Create, move, remove, update props, update layout.
2. Create, rename, reorder, remove, and `update-page-route` page actions.
3. Scene replay from action log.
4. Renderer that can render a page from scene graph.

Acceptance criteria:

1. A sample multi-page document can be created from document actions plus runtime actions.
2. Replaying the document and scene event logs rebuilds the same document state.
3. Renderer reads from scene graph only.
4. Page route updates pass document validation and replay correctly.

## 3. Phase 2: Layout And Editor Basics

Scope:

1. Grid layout.
2. Selection.
3. Resize.
4. Move interactions.
5. Rotate interactions.
6. Viewport state.

Deliverables:

1. Grid engine with collision detection.
2. Selection system and overlays.
3. Drag move, resize, and `rotate-node` actions.

Acceptance criteria:

1. Widgets can be selected, moved, resized, and rotated when supported by layout mode and plugin capability.
2. Undo and redo work for move, resize, and rotate interactions.
3. Grid layout remains valid after interactions, and invalid rotate requests are rejected deterministically.

## 4. Phase 3: Semantic Compiler

Scope:

1. Semantic actions.
2. Compiler pipeline.
3. Planner.
4. AI component metadata.

Deliverables:

1. `create-dashboard`
2. `insert-chart`
3. Compiler diagnostics.
4. AI schema index from plugin metadata.

Acceptance criteria:

1. Semantic actions compile into document actions and/or runtime actions.
2. Invalid semantic requests produce diagnostics instead of broken scenes.
3. Generated dashboards satisfy required semantic constraints.

## 5. Phase 4: AI Integration And Constraints

Scope:

1. Tool calling integration.
2. Auto layout.
3. Constraint engine.
4. AI-driven modifications.

Deliverables:

1. AI request to semantic action conversion.
2. Constraint validation pipeline.
3. Auto-layout strategies.

Acceptance criteria:

1. AI can create and modify pages without direct scene mutation.
2. Invalid AI requests are blocked or degraded safely.
3. Layout suggestions produce valid runtime actions.

## 6. Phase 5: Collaboration

Scope:

1. Shared editing.
2. Presence state.
3. Conflict convergence.
4. Multiplayer history behavior.

Deliverables:

1. Action sync over CRDT or OT.
2. Remote cursor and selection presence.
3. Deterministic convergence tests.

Acceptance criteria:

1. Concurrent edits converge consistently.
2. Shared scenes remain valid after sync.
3. Undo policy for collaborative edits is explicitly defined and tested.

## 7. Cross Phase Engineering Requirements

Every phase should include:

1. Type-safe public contracts.
2. Schema validation for external inputs.
3. Fixture scenes for regression testing.
4. Action replay tests.
5. Documentation updates.

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

1. Create sample dashboard from runtime actions only.
2. Drag and resize cards on a grid page.
3. Invoke `create-dashboard` semantic action and compile it.
4. Replay action log to reconstruct dashboard.
5. Simulate two-user collaboration update stream.
