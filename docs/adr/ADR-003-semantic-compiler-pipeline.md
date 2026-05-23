# ADR-003: Semantic Compiler Pipeline

## Status

Accepted

## Context

The product is AI-native, but the runtime engine requires deterministic, validated mutations. Letting AI directly generate scene JSON or arbitrary runtime actions would bypass engine invariants and make replay and validation unreliable.

## Decision

AI may only emit semantic intent, not direct scene mutations.

The semantic compiler is the required bridge between AI intent and engine execution.

Pipeline:

1. Normalize
2. Intent Expansion
3. Constraint Precheck
4. Layout Planning
5. Action Expansion
6. Validation
7. Execution Plan

Compiler output is an execution plan containing:

1. `documentActions`
2. `runtimeActions`

Compiler result uses an explicit success or failure contract:

1. Success always includes an execution plan.
2. Failure always includes diagnostics.
3. Failure must not emit a partial plan.

## Consequences

Positive:

1. AI remains constrained by engine rules
2. Layout, constraints, and plugin availability are checked before commit.
3. Multi-page AI flows can create pages and scene content in one plan.

Tradeoffs:

1. Compiler logic becomes a significant subsystem.
2. Semantic action design needs careful control to avoid surface explosion.

## Rejected Alternatives

1. AI generates raw scene JSON
   Rejected because it bypasses validation and makes behavior hard to replay safely.

2. AI emits runtime actions directly
   Rejected because runtime actions are too low-level and easy for models to misuse.
