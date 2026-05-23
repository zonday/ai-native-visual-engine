# ADR-002: Runtime Action And History Model

## Status

Accepted

**Date:** 2026-05

**Prerequisites:** ADR-001 (SceneGraph as SSOT)

**Related:**

- `docs/spec/runtime-engine.md` — implements the action model
- `docs/spec/document-runtime.md` — parallel action model for document domain
- `docs/spec/history-and-undo-redo.md` — undo/redo built on action history
- `ADR-001` — prerequisite
- `ADR-004` — related split between document and scene actions

## Context

The engine needs a mutation model that supports direct editing, AI-generated changes, replay, undo and redo, and collaboration.

Ad hoc mutations against document or scene state would make correctness, validation, rollback, and cross-user synchronization difficult to reason about.

## Decision

All scene mutations use atomic `RuntimeAction` values.

Every runtime action must be:

1. Deterministic.
2. Replayable.
3. Reversible.
4. Atomic.
5. Serializable.

Scene runtime actions are dispatched through a command bus, middleware pipeline, and typed handlers.

History rules:

1. Durable scene content history tracks content-changing runtime actions only.
2. Session-only actions such as `update-selection` do not enter durable history.
3. Invalid scene mutations are rejected at commit time by default.
4. Collaborative undo and redo operate on each actor's own durable actions only.

## Consequences

Positive:

1. Runtime behavior can be replayed and audited.
2. Undo and redo are explicit rather than implicit snapshots everywhere.
3. Middleware can enforce validation, logging, and collaboration consistently.

Tradeoffs:

1. Every new editing capability needs an explicit action contract.
2. Batch and inverse action design requires more discipline than direct mutation.

## Rejected Alternatives

1. Snapshot-only history without atomic actions
   Rejected because it weakens replay, collaboration transport, and fine-grained auditing.

2. Direct handler mutation without command bus or middleware
   Rejected because validation and history logic would become duplicated and inconsistent.
