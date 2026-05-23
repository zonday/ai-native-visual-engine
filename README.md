# AI Native Visual Engine

Implementation-oriented specification repository for an AI-native visual editor engine.

## Contents

- `docs/spec/README.md`: overview and design principles
- `docs/spec/domain-model.md`: document, page, scene, node, layout, and state ownership
- `docs/spec/runtime-engine.md`: runtime actions, command bus, middleware, handlers, and history
- `docs/spec/semantic-system.md`: semantic actions, compiler pipeline, and AI schema
- `docs/spec/plugin-system.md`: plugin contracts, registry, and renderer boundaries
- `docs/spec/engine-api.md`: public API surface for plugins, components, and the editor shell
- `docs/spec/component-types.md`: built-in types and default plugin component definitions
- `docs/spec/component-states.md`: named component states, props overrides, and exclusive state groups
- `docs/spec/prototype-components.md`: user-definable reusable component presets and instance inheritance
- `docs/spec/rich-text.md`: rich text model, Tiptap integration, and Markdown interop
- `docs/spec/editor-interaction.md`: selection, transform, drag and drop, multi-page, and collaboration
- `docs/spec/collaboration-framework.md`: Yjs transport, action sync, presence, and conflict convergence
- `docs/spec/collaboration-infrastructure.md`: Cloudflare Workers + Durable Objects relay and persistence
- `docs/spec/history-and-undo-redo.md`: undo/redo model, inverse-action contracts, and collaboration-history interaction
- `docs/spec/constraints-and-validation.md`: constraint system and validation layers
- `docs/spec/schema-validation.md`: Zod schema strategy, trust boundaries, and plugin schema contract
- `docs/spec/roadmap.md`: phased delivery and acceptance criteria
- `docs/spec/document-runtime.md`: document-level actions, command bus, history, and event log
- `docs/spec/bootstrap-and-lifecycle.md`: document initialization, session lifecycle, and import/export
- `docs/spec/renderer-contract.md`: renderer interface, rendering modes, and fallback policies
- `docs/spec/testing-and-fixtures.md`: test strategy, fixture format, and per-phase test requirements
- `docs/spec/persistence-and-serialization.md`: storage, serialization, snapshot, and event log truncation
- `docs/spec/error-handling.md`: error taxonomy, propagation, and recovery strategies
- `docs/spec/theme-and-tokens.md`: theme model, token system, and cascade rules
- `docs/spec/data-binding.md`: data source binding, variable resolution, and binding lifecycle
- `docs/spec/data-interaction.md`: cross-filtering, drill-down, drill-through, and filter integration
- `docs/spec/implementation-stack.md`: engineering toolchain, package layout, and runtime environment
- `docs/spec/deployment.md`: Cloudflare Pages deployment and CI pipeline
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
