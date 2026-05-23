# Open Questions And ADR Candidates

## 1. Purpose

This document records unresolved decisions that should become ADRs or follow-up specs.

## 2. High Priority Questions

1. Should `selection` be persisted in scene snapshots or kept only in collaborative session state?
2. Is page management part of the same event log as scene runtime actions, or a separate document event stream?
3. Should layout engines normalize invalid geometry automatically or always reject invalid mutations?
4. What is the canonical undo policy for collaborative edits?
5. How should unknown plugin types behave in runtime preview versus editor mode?

## 3. AI System Questions

1. How many semantic actions should exist in MVP before the action surface becomes too granular?
2. Should compiler planning be template-driven, heuristic-driven, or hybrid?
3. How should AI request missing information from the user when semantic intent is underspecified?
4. How should generated content reference real datasets versus mock datasets?

## 4. Renderer Questions

1. Should React be the only MVP renderer, with canvas reserved for later, or should renderer abstraction be proven earlier?
2. Which node types require virtualization for large scenes?
3. How should measurement and auto-sizing interact with deterministic replay?

## 5. Plugin System Questions

1. Can plugins contribute semantic templates, or should semantic planning stay centralized in core?
2. Can plugins define custom inspector panels without violating core state boundaries?
3. How should versioning and migration work when plugin metadata changes over time?

## 6. Recommended Next ADR Topics

1. ADR-001: SceneGraph as SSOT
2. ADR-002: Runtime Action and History Model
3. ADR-003: Semantic Compiler Pipeline
4. ADR-004: Document Actions vs Scene Actions
5. ADR-005: Collaboration Transport Strategy
