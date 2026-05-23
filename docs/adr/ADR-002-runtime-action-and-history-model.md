# ADR-002: Runtime Action And History Model

## Status

Accepted

## Context

The engine needs a mutation model that supports direct editing, AI-generated changes, replay, undo and redo, and collaboration.

Ad hoc mutations against document or scene state would make correctness, validation, rollback, and cross-user synchronization difficult to reason about.

## Decision

All scene mutations use atomic `RuntimeAction` values.

Every runtime action must be:

1. deterministic
2. replayable
3. reversible
4. atomic
5. serializable

Scene runtime actions are dispatched through a command bus, middleware pipeline, and typed handlers.

History rules:

1. durable scene content history tracks content-changing runtime actions only
2. session-only actions such as `update-selection` do not enter durable history
3. invalid scene mutations are rejected at commit time by default
4. collaborative undo and redo operate on each actor's own durable actions only

## Consequences

Positive:

1. runtime behavior can be replayed and audited
2. undo and redo are explicit rather than implicit snapshots everywhere
3. middleware can enforce validation, logging, and collaboration consistently

Tradeoffs:

1. every new editing capability needs an explicit action contract
2. batch and inverse action design requires more discipline than direct mutation

## Rejected Alternatives

1. Snapshot-only history without atomic actions
   Rejected because it weakens replay, collaboration transport, and fine-grained auditing.

2. Direct handler mutation without command bus or middleware
   Rejected because validation and history logic would become duplicated and inconsistent.
