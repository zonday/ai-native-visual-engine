<!-- Context: project-intelligence/business | Priority: high | Version: 1.0 | Updated: 2026-05-23 -->

# Business Domain

**Purpose**: Defines the product concepts, user goals, and business rules that shape this AI-native visual editor engine.
**Last Updated**: 2026-05-23

## Quick Reference

**Audience**: Product, design, developers, and AI agents
**Update Triggers**: Product scope changes, workflow changes, new domain rules, collaboration policy changes

## Product Mission

Concept: The product is an AI-native visual editor for multi-page dashboards where AI and direct manipulation both operate through the same controlled engine model.

- Users build and edit dashboards visually.
- AI can generate and modify pages through semantic intent.
- The engine must support multi-page documents, runtime rendering, undo/redo, and collaboration.
- The repository currently defines architecture and rules before implementation.

```text
User intent
  -> Semantic action
  -> Compiler
  -> Document/runtime actions
  -> Scene graph
  -> Editor + runtime preview
```

Ref: `docs/spec/README.md`

## Core Business Objects

Concept: The product centers on a document that owns pages, and each page maps to one scene used by both the editor and renderer.

- `VisualDocument` is the top-level editing artifact.
- `Page` is a routeable unit within the document.
- `SceneGraph` is the authoritative state for one page.
- `SceneNode` represents a renderable node in the scene tree.
- Themes, assets, and variables belong to the document layer.

```ts
type CoreObjects =
  | 'VisualDocument'
  | 'Page'
  | 'SceneGraph'
  | 'SceneNode'
  | 'Theme'
  | 'Variable'
```

Ref: `docs/spec/domain-model.md`

## Primary Users And Outcomes

Concept: The engine is designed for users who need to assemble dashboards quickly while keeping structure valid and implementation-safe.

- Dashboard builders need fast page creation and editing.
- AI-assisted users need high-level generation without breaking structure.
- Developers need deterministic engine behavior they can implement and test.
- Reviewers need clear invariants for replay, undo/redo, and collaboration.

```text
Primary outcome: valid dashboard pages
Secondary outcome: fast iteration with AI + visual editing
Guardrail: no invalid scene mutations
```

Ref: `README.md`

## Workflow Rules

Concept: All meaningful product changes must flow through a constrained mutation pipeline instead of ad hoc UI state changes.

- AI may emit semantic intent, not raw scene JSON.
- User gestures compile into runtime actions.
- Document-level page operations stay separate from scene runtime operations.
- Final committed state must be replayable, undoable, and collaboration-safe.
- Renderer output must never become the source of truth.

```text
AI/user action
  -> semantic or runtime/document action
  -> validation + middleware
  -> committed document/scene state
```

Ref: `docs/spec/semantic-system.md`

## Persistence And Session Boundaries

Concept: The product distinguishes durable content state from temporary editing state so collaboration and undo stay predictable.

- Persistent state includes page definitions, node tree, props, layout, and visibility.
- Session-only state includes hover state, drag preview, active panel tab, and pointer position.
- Selection and viewport affect editor continuity and collaboration semantics, but not all session data should be durable.
- Presence state such as cursors and remote outlines is ephemeral.

```text
Persistent: document + scene content
Session: interaction previews + local editor UI
Presence: remote collaborator hints
```

Ref: `docs/spec/editor-interaction.md`

## Business Constraints

Concept: Product flexibility is intentionally limited by engine rules so generated and edited dashboards remain valid.

- `SceneGraph` is the source of truth for page structure and visual state.
- Actions must be deterministic, replayable, reversible, and atomic.
- Invalid structure must be rejected or predictably normalized.
- Multi-page support is first-class, not an afterthought.
- Plugin extensibility is allowed, but core invariants still apply.

```text
Allowed: guided extension through plugins
Not allowed: arbitrary direct scene mutation by AI
Required: valid state after every committed action
```

Ref: `docs/spec/README.md`

## Collaboration And History Policy

Concept: Multiplayer editing must converge through the same action model used for single-user editing.

- Concurrent edits should converge consistently.
- Remote durable changes must map into the shared action model.
- Presence data may be collaborative without being persisted.
- Undo/redo behavior must restore meaningful committed state.

```text
Local commit -> action log
Remote commit -> same model
Presence -> separate ephemeral channel
```

Ref: `docs/spec/editor-interaction.md`

## 📂 Codebase References

- `README.md`: repository goal and scope
- `docs/spec/README.md`: design goals, invariants, and system layers
- `docs/spec/domain-model.md`: document/page/scene vocabulary
- `docs/spec/semantic-system.md`: AI intent and compiler flow
- `docs/spec/editor-interaction.md`: interaction, persistence, and collaboration rules
- Current status: repository is spec-first; business behavior is defined in docs, not implementation code yet
