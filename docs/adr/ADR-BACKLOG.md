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

| # | ADR | Rationale | Blocks |
|---|-----|-----------|--------|
| 1 | ADR-006: Semantic Action Surface | Defines the AI-facing API contract. Without it, the compiler cannot know which intents to accept. Blocks ADR-007 and Phase 3 implementation. | ADR-007 |
| 2 | ADR-007: Semantic Planning Strategy | Depends on the action surface being defined. Determines how the compiler fills gaps in AI intent, which affects constraint precheck, layout planning, and error recovery. | Phase 3 compiler implementation |
| 3 | ADR-009: Plugin Extensibility And Migration | Affects the plugin registry, semantic template contributions, and node migration. Should be decided before Phase 4 (AI integration) so AI-generated nodes follow a stable migration policy. | Phase 4 AI integration |
| 4 | ADR-008: Renderer Evolution Strategy | Canvas/virtualization decisions only become critical at scale. Post-MVP timing is acceptable; the React renderer handles Phase 1-5 MVP scope. | — |
| 5 | ADR-010: Post-MVP History And Activity UX | Purely a post-MVP UX concern. Does not block any implementation milestone. | — |
