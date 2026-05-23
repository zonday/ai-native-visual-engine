# ADR-005: Collaboration Transport Strategy

## Status

Accepted

## Context

The engine must support collaboration, but collaboration should not replace the core action model. It should transport and reconcile the same durable actions already used locally.

The system also needs a clear distinction between durable shared state and ephemeral presence state.

## Decision

Collaboration wraps the action model instead of bypassing it.

Rules:

1. Durable shared state is transported as document actions and scene runtime actions.
2. Ephemeral presence state such as cursor position, selection highlight, and viewport hint is transported separately from durable action logs.
3. Session-only actions such as local selection changes do not enter durable collaborative event logs by default.
4. Collaborative undo and redo operate on the current actor's own durable actions only.
5. Yjs or OT may be used as the transport or convergence layer, but the engine-level semantic model remains action-based.

## Consequences

Positive:

1. Local and remote updates share one mutation model.
2. Collaboration does not need a second semantics layer for content edits.
3. Presence can evolve independently from durable document consistency.

Tradeoffs:

1. The transport layer must preserve action ordering and actor identity carefully.
2. Cross-user undo semantics remain intentionally conservative.

## Rejected Alternatives

1. Replace the engine action model with CRDT-native document mutation only
   Rejected because it would duplicate domain semantics outside the engine architecture.

2. Treat selection and viewport as durable shared collaborative state
   Rejected because they are user-scoped session overlays, not shared content.
