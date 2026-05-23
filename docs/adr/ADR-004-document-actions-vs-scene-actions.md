# ADR-004: Document Actions Vs Scene Actions

## Status

Accepted

**Date:** 2026-05

**Prerequisites:** ADR-001, ADR-002

**Related:**

- `docs/spec/document-runtime.md` — implements document actions
- `docs/spec/runtime-engine.md` §11 — boundary between the two domains
- `docs/spec/history-and-undo-redo.md` — separate histories per domain
- `ADR-001`, `ADR-002` — prerequisites

## Context

The engine supports multi-page documents. Some mutations change page-level structure such as page creation, route updates, or theme overrides, while others change node-level scene content.

Treating all mutations as one undifferentiated action domain would blur persistence boundaries and complicate history, replay, and validation.

## Decision

The engine uses two parallel durable action domains:

1. `DocumentAction`
   For page lifecycle, page routing, theme attachment, and other document-level state.

2. `RuntimeAction`
   For scene node structure and layout mutations within one page scene.

Rules:

1. Document and scene histories remain separate engine domains.
2. Document actions mutate `VisualDocument`.
3. Runtime actions mutate active page `SceneGraph` or persisted scene content through the scene runtime pipeline.
4. Semantic compiler plans may include both action kinds in one execution sequence.
5. Primary undo and redo remain focus-scoped by action domain.

## Consequences

Positive:

1. Multi-page concerns stay explicit and testable.
2. Route, theme, and page lifecycle logic do not leak into scene handlers.
3. History and replay remain semantically clear.

Tradeoffs:

1. Some operations require coordinating two action domains.
2. The UI must choose the correct undo scope based on editing focus.

## Rejected Alternatives

1. Model page lifecycle as scene runtime actions
   Rejected because pages and document metadata are not scene-local concepts.

2. Keep document changes outside the action system entirely
   Rejected because it would create a split architecture for history, collaboration, and replay.
