# ADR-001: SceneGraph As SSOT

## Status

Accepted

**Date:** 2026-05

**Prerequisites:** None.

**Related:**

- `docs/spec/domain-model.md` — implements the SSOT architecture
- `docs/spec/renderer-contract.md` — renderer is pure with respect to SSOT
- `docs/spec/runtime-engine.md` — all mutations go through SSOT
- `ADR-002` — builds on this decision for the action/history model

## Context

The engine must support visual editing, AI-assisted generation and modification, undo and redo, replay, collaboration, and renderer switching without splitting page state across multiple competing stores.

If page structure or visual state lives primarily in React local state or scattered editor stores, the engine cannot reliably guarantee deterministic replay, collaboration, or cross-renderer consistency.

## Decision

`SceneGraph` is the single source of truth for active page state.

The model is split into:

1. `PersistedSceneGraph`
   Durable page scene content used for persistence, import/export, and replay.

2. `SceneGraph`
   In-memory active page state used by the editor and extended with session overlays such as `selection` and `viewport`.

Rules:

1. Page structure, node hierarchy, props, layout, style, bindings, and persisted runtime metadata belong to the scene model.
2. React local state may exist only for ephemeral UI state that does not define page meaning.
3. Session overlays such as selection and viewport do not belong to shared persisted document content.
4. `VisualDocument.scenes` is the canonical owner of persisted page scenes

## Consequences

Positive:

1. Undo and redo operate against one canonical page model.
2. Replay and collaboration have a stable mutation target.
3. Renderer implementations stay pure with respect to scene data.
4. AI cannot bypass engine invariants by mutating arbitrary JSON blobs

Tradeoffs:

1. Editors must explicitly model session-only overlays instead of casually storing them in component state.
2. Scene hydration and materialization logic must distinguish persisted scene content from in-memory overlays.

## Rejected Alternatives

1. React component state as the primary page model
   Rejected because replay, collaboration, and cross-renderer consistency become fragile.

2. Multiple co-equal stores for structure, layout, and selection
   Rejected because invariants become distributed and harder to validate.
