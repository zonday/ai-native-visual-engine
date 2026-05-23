# AI Native Visual Engine

Implementation-oriented specification repository for an AI-native visual editor engine.

## Contents

- `docs/spec/README.md`: overview and design principles
- `docs/spec/domain-model.md`: document, page, scene, node, layout, and state ownership
- `docs/spec/runtime-engine.md`: runtime actions, command bus, middleware, handlers, and history
- `docs/spec/semantic-system.md`: semantic actions, compiler pipeline, and AI schema
- `docs/spec/plugin-system.md`: plugin contracts, registry, and renderer boundaries
- `docs/spec/editor-interaction.md`: selection, transform, drag and drop, multi-page, and collaboration
- `docs/spec/constraints-and-validation.md`: constraint system and validation layers
- `docs/spec/roadmap.md`: phased delivery and acceptance criteria
- `docs/spec/document-runtime.md`: document-level actions, command bus, history, and event log
- `docs/spec/bootstrap-and-lifecycle.md`: document initialization, session lifecycle, and import/export
- `docs/spec/renderer-contract.md`: renderer interface, rendering modes, and fallback policies
- `docs/spec/testing-and-fixtures.md`: test strategy, fixture format, and per-phase test requirements
- `docs/spec/persistence-and-serialization.md`: storage, serialization, snapshot, and event log truncation
- `docs/adr/README.md`: accepted architecture decisions and ADR backlog

## Goal

Define the architecture and delivery plan for an engine that supports:

- AI page generation
- AI-driven page updates
- scene graph based editing
- multi-page dashboards
- runtime rendering
- plugin extension
- undo and redo
- collaboration

## Status

Current repository state focuses on architecture specification before core implementation.
