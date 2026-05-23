# Roadmap And Acceptance

## 1. Delivery Strategy

The engine should be built in phases that preserve a usable internal spine from the first milestone onward.

Each phase must end with:

1. A working demo path.
2. Explicit acceptance criteria.
3. A stable API surface for the next phase.

## 2. Phase 1: Core Engine Spine

Scope:

1. Document snapshot model and persistence (`DocumentSnapshot`, `DocumentEventLog`, `SceneEventLog`).
2. Scene graph model (`SceneGraph`, `PersistedSceneGraph`, `SceneNode`, `Layout` hierarchy).
3. Built-in component types (`container`, `grid`, `text`).
4. Full `DocumentAction` union: page lifecycle, theme management, batch actions.
5. Full `RuntimeAction` union: node CRUD, rotate, selection, bindings, runtime state, batch.
6. Document and scene command buses with middleware pipelines.
7. History and undo/redo model — inverse actions for all durable actions, focus-scoped undo stacks.
8. Event sourcing — replay from event log with actor identification.
9. Bootstrap and session lifecycle — document initialization, page switching, import/export.
10. `EngineAPI` surface for plugins and components.
11. Zod schema validation for all action payloads and external inputs.
12. Error taxonomy and propagation from handler to UI.
13. Theme model and token cascade — built-in base theme, document/page overrides.
14. React renderer with editor and runtime modes, layout rendering, and `MissingPluginPlaceholder`.

Deliverables:

1. Create, move, remove, rotate, update-props, update-style, update-bindings, update-runtime.
2. Create, rename, reorder, remove, update-route, set-theme page and document actions.
3. Scene and document replay from event logs.
4. Renderer that renders all three built-in types from a scene graph.
5. Undo/redo for all durable actions.
6. Document initialization, page switching, import, and export.
7. Zod schemas for all action payloads and core types.
8. Structured error propagation from handler to editor UI.

Acceptance criteria:

1. A sample multi-page document can be created from document actions plus runtime actions.
2. Replaying the document and scene event logs rebuilds identical state.
3. Undo and redo round-trip works for every action type.
4. Renderer reads from scene graph only and produces correct output for all three built-in types.
5. All invalid actions are rejected with structured error codes.
6. Import of a valid `DocumentSnapshot` produces an editable document.
7. Export produces a `DocumentSnapshot` without session overlays.

## 3. Phase 2: Editor Interactions And Rich Text

Scope:

1. Grid layout engine with collision detection.
2. Selection system with overlays, multi-select, marquee, and parent/child navigation.
3. Drag move, resize, and rotate interactions.
4. Viewport state and zoom.
5. Rich text editing on `text` nodes via Tiptap — JSON document model, formatting toolbar, Markdown import/export.
6. Default plugin components: `metric-value`, `metric-trend`, `metric-comparison`, `chart`, `table`, `header`, `divider`, `filter`.

Deliverables:

1. Grid layout engine with deterministic collision resolution.
2. Selection chrome and overlay rendering.
3. Drag move, resize, and `rotate-node` interactions producing valid runtime actions.
4. Tiptap editor integration with full formatting surface.
5. All 8 default plugins registered and renderable.

Acceptance criteria:

1. Widgets can be selected, moved, resized, and rotated when supported.
2. Undo and redo work for all interaction-driven mutations.
3. Grid layout remains valid after all interactions.
4. Rich text editing produces valid Tiptap JSON content.
5. `update-props` dispatch on `text` content validates the JSON structure.
6. All 8 default plugins render correctly from their props.

## 4. Phase 3: Semantic Compiler And Data Interaction

Scope:

1. Semantic actions (`create-dashboard`, `insert-chart`, `auto-layout`, `update-theme-intent`).
2. Full compiler pipeline: normalize → intent expansion → constraint precheck → layout planning → action expansion → validation.
3. AI component metadata generation from plugin registration.
4. Data binding — `DataSourceRegistry`, dataset and variable resolution, binding lifecycle.
5. Data interaction — cross-filtering, drill-down, drill-through.
6. `DataInteractionAPI` for plugins.
7. Filter component integration with data bindings.

Deliverables:

1. `create-dashboard` semantic action producing a valid execution plan.
2. `insert-chart` semantic action targeting a valid container.
3. `auto-layout` with compact/balanced/presentation strategies.
4. Compiler diagnostics for invalid semantic requests.
5. AI schema index built from plugin metadata.
6. Data binding resolution with re-resolve on source change.
7. Cross-filtering — clicking a chart bar filters a table on the same page.
8. Drill-down — navigating year → quarter → month with state restoration.
9. Drill-through — navigating from a data point to a detail page.

Acceptance criteria:

1. Semantic actions compile into valid document actions and/or runtime actions.
2. Invalid semantic requests produce diagnostics instead of broken scenes.
3. Generated dashboards satisfy required semantic constraints.
4. Data bindings resolve and re-resolve correctly on source change.
5. Cross-filtered components agree on the same filtered dataset.
6. Drill-down drill-up round-trip restores correct state.

## 5. Phase 4: AI Integration And Constraints

Scope:

1. AI tool-calling integration — model output to `SemanticAction`.
2. Auto-layout strategies for AI-generated dashboards.
3. Full constraint validation pipeline — schema, referential, structural, semantic, presentation.
4. AI-driven page modifications through existing action model.
5. AI metadata consumption (`ai.usage`, `ai.antiPatterns`, `ai.relatedComponents`, `ai.keywords`).

Deliverables:

1. AI request to `SemanticAction` conversion layer.
2. Constraint validation pipeline executing in middleware.
3. Auto-layout strategies for common dashboard patterns.
4. AI metadata-driven component selection.

Acceptance criteria:

1. AI can create and modify pages without direct scene mutation.
2. Invalid AI requests are blocked or degraded with diagnostics.
3. Layout suggestions produce valid runtime actions.
4. AI respects plugin `ai.antiPatterns` and chooses correct `ai.relatedComponents`.

## 6. Phase 5: Collaboration

Scope:

1. Yjs client integration — action transport, presence, conflict convergence.
2. Collaboration middleware in document and scene command buses.
3. Actor-local undo — remote actions do not enter local undo stack.
4. Multiplayer history behavior — redo stack cleared on remote update.
5. Cloudflare Workers + Durable Objects relay infrastructure.
6. R2 persistence for Durable Object state.
7. JWT authentication for collaboration sessions.
8. Read-only observer sessions.

Deliverables:

1. Action sync over Yjs with deterministic convergence.
2. Remote cursor and selection presence via Yjs awareness.
3. Cloudflare DO relay with per-document room isolation.
4. Deterministic convergence tests and reconnection tests.
5. Presence cleanup on disconnect.

Acceptance criteria:

1. Concurrent edits converge consistently across peers.
2. Shared scenes remain valid after sync from any peer.
3. Undo policy for collaborative edits is explicitly defined and tested.
4. Remote actions do not enter local undo stack.
5. Disconnect and reconnect preserves state.
6. Read-only observers see changes without mutating.

## 7. Phase 6: Deployment And Production Readiness

Scope:

1. Cloudflare Pages deployment for the editor SPA.
2. CI pipeline with automatic preview deployments per PR.
3. Production CI with build, lint, typecheck, test, and deploy.
4. Environment variable management for collaboration and API URLs.
5. Custom domain setup.

Deliverables:

1. `wrangler.toml` configuration for editor and collab Worker.
2. GitHub Actions workflow for PR previews and production deploy.
3. Collaboration Worker deployment with Durable Objects.
4. Documentation for local development setup.

Acceptance criteria:

1. PR preview deployments are accessible at unique URLs.
2. Main branch merges deploy to production.
3. Collaboration relay handles multiple concurrent documents.
4. Local development supports the full engine, editor, and collab stack.

## 8. Cross Phase Engineering Requirements

Every phase must include:

1. Type-safe public contracts — Zod schemas for all boundary types.
2. Schema validation for external inputs.
3. Fixture scenes for regression testing.
4. Action replay tests.
5. Undo/redo tests for all new actions.
6. Documentation updates.

## 9. Package Structure

Monorepo layout as defined in `implementation-stack.md`:

```text
packages/
  core/
    document/   # Document actions, command bus, middleware, event log
    scene/      # Scene graph, runtime actions, command bus, middleware
    compiler/   # Semantic compiler pipeline
    semantic/   # Semantic action types
    constraints/# Constraint engine
    plugins/    # Plugin registry and contracts
    layout/     # Layout types and engines
    __fixtures__/# Regression test fixtures
  renderer-react/ # React renderer
  editor/        # Editor UI shell
  ai/            # AI integration
```

## 10. Milestone Demo Scenarios

1. Create sample dashboard from runtime actions only — Phase 1.
2. Drag, resize, and rotate widgets on a grid page — Phase 2.
3. Edit rich text inline on a dashboard — Phase 2.
4. Invoke `create-dashboard` semantic action and compile it — Phase 3.
5. Cross-filter a chart → table on the same page — Phase 3.
6. Drill down from year to quarter to month — Phase 3.
7. Replay action log to reconstruct dashboard — Phase 1 (all phases regress).
8. Simulate two-user collaboration update stream — Phase 5.
