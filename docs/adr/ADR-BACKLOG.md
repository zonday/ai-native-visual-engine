# ADR Backlog

## Purpose

This document tracks architecture decisions that are still important, but are not yet formalized as accepted ADRs.

## Remaining ADR Topics

1. ADR-006: Semantic Action Surface
   Decide the MVP semantic action set, naming rules, granularity limits, and expansion boundaries so the action surface stays usable for both humans and models.

2. ADR-007: Semantic Planning Strategy
   Decide whether compiler planning is template-driven, heuristic-driven, or hybrid, and define how AI should handle missing inputs, follow-up questions, and mock-vs-real dataset references.

3. ADR-008: Renderer Evolution Strategy
   Decide how long React remains the only renderer, when canvas or virtualization is required, and how measurement or auto-sizing can coexist with deterministic replay.

4. ADR-009: Plugin Extensibility And Migration
   Decide whether plugins may contribute semantic templates or custom inspector panels, and define the migration and versioning protocol for plugin-driven persisted nodes over time.

5. ADR-010: Post-MVP History And Activity UX
   Decide whether the product should add a merged activity timeline after MVP, how cross-domain transaction grouping would work, and how that view should differ from primary undo and redo.

## Suggested Order

1. ADR-006: Semantic Action Surface
2. ADR-007: Semantic Planning Strategy
3. ADR-009: Plugin Extensibility And Migration
4. ADR-008: Renderer Evolution Strategy
5. ADR-010: Post-MVP History And Activity UX
