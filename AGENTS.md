# AI Agent Constraints

This file is read by AI coding agents operating in this repository. All agents MUST follow these rules.

## Architecture Hard Rules

These are non-negotiable. Any violation blocks implementation.

1. `SceneGraph` is the single source of truth for page structure and visual state.
2. AI MUST NOT generate or mutate raw `SceneGraph` directly. AI may only produce semantic intent (`SemanticAction`) through the compiler.
3. AI MUST NOT bypass the command bus. All state mutations go through `DocumentAction` or `RuntimeAction` via `DocumentCommandBus.dispatch` or `CommandBus.dispatch`.
4. Renderer output MUST NOT become the source of truth. The renderer is pure with respect to scene data.
5. Every durable action MUST be deterministic, replayable, reversible, atomic, and serializable.
6. Session-only state (`selection`, `viewport`, `hover`, `drag preview`) MUST NOT be persisted into `DocumentSnapshot` or `SceneEventLog`.
7. `selection` and `viewport` are session-scoped by default and are NOT serialized into `VisualDocument.scenes`.

## Tech Stack

| Category | Choice | Version |
|------|------|------|
| Package manager | pnpm | >= 11.2 |
| Monorepo orchestration | turborepo | >= 2.9 |
| Language | TypeScript strict | >= 5.6 |
| Library bundler | tsdown | >= 0.22 |
| Web bundler / dev server | vite | >= 8.0 |
| Testing | vitest | >= 4.1 |
| Lint + format | biome | >= 2.4 |
| State management | zustand | >= 5.0 |
| Styling | tailwindcss + shadcn/ui | >= 4.3 |
| Graph layout | dagre | >= 0.8 |
| Collaboration | yjs + y-websocket | >= 13.6 |
| Runtime | Node.js | >= 22.13 LTS |
| Browser target | ES2022, last 2 versions | — |

## Code Standards

1. TypeScript strict mode — no `// @ts-ignore`, no `any` without explicit justification.
2. Functional React components only — no class components.
3. Prefer composition over prop flags for variant-heavy UI.
4. Tailwind for styling — no ad hoc CSS unless unavoidable.
5. Use shadcn/ui as the default primitive layer.
6. Explicit prop types — never `any` on component props.
7. Co-locate component, hook, and schema by feature when practical.
8. Aliased imports only if project config already supports them.

## Testing

Every new feature, bug fix, and behavior change MUST include tests. Tests MUST be meaningful.

### Test Requirements

1. Every new `RuntimeAction` handler MUST have tests covering the happy path, every documented failure path, and the inverse action round-trip.
2. Every new `DocumentAction` handler MUST have tests covering create/update/delete paths and unique-constraint violations.
3. Every new compiler pipeline stage MUST have tests covering valid input to expected output and invalid input to expected diagnostics.
4. Every new renderer component MUST have at least one test verifying correct rendering from a minimal scene fixture.
5. Bug fixes MUST include a regression test that fails before the fix and passes after.

### Meaningful Tests

A test is meaningful only when it verifies observable behavior. Musts and must-nots:

1. MUST assert a specific expected output or state, not just that code ran without throwing.
2. MUST cover failure paths, not only the happy path.
3. MUST NOT consist solely of snapshot assertions without documented expected behavior.
4. MUST NOT test implementation details such as internal function call counts or private field values.
5. MUST use the fixtures defined in `docs/spec/testing-and-fixtures.md` for scene and document inputs.
6. Each test description MUST state the scenario and the expected outcome.

```ts
// Meaningful
it('rejects create-node when parent does not exist', () => {
  const action = { type: 'create-node', node: sampleNode, parentId: 'missing' }
  const result = dispatch(action)
  expect(result.ok).toBe(false)
  expect(result.error?.code).toBe('scene.node-not-found')
})

// NOT meaningful
it('handles create-node', () => {
  const action = { type: 'create-node', node: sampleNode, parentId: root.id }
  expect(() => dispatch(action)).not.toThrow()
})
```

## Naming Conventions

| Category | Convention | Example |
|------|------|------|
| Files | kebab-case | `panel-header.tsx` |
| Components | PascalCase | `EditorCanvas` |
| Types / interfaces | PascalCase | `DocumentAction` |
| Functions | camelCase | `buildExecutionPlan` |
| Hooks | camelCase + `use` prefix | `useEditorState` |
| Constants | SCREAMING_SNAKE_CASE | `DEFAULT_GRID_COLUMNS` |

## Security

1. Validate all external input at boundaries.
2. Sanitize user-provided HTML / rich text before rendering.
3. Never trust client-only authorization state.
4. Keep secrets, tokens, and keys out of frontend bundles.
5. Avoid `dangerouslySetInnerHTML` unless sanitized.
6. Validate URL and query params before use.
7. Prefer typed API contracts at boundaries (Zod or similar).

## Package Boundaries

| Package | Dir | Rules |
|------|------|------|
| @ai-native/core | `packages/core/` | Framework-agnostic. No React imports. No DOM imports. |
| @ai-native/renderer-react | `packages/renderer-react/` | Depends on core. Renders scene → React tree. No editor state. |
| @ai-native/editor | `packages/editor/` | Depends on core + renderer-react. Owns editor UI and state. |
| @ai-native/ai | `packages/ai/` | Depends on core. Tool-call integration. No direct scene mutation. |

Core invariants enforced at package boundaries:

1. `core/` must not import from `renderer-react/`, `editor/`, or `ai/`.
2. `renderer-react/` must not mutate scene state.
3. `editor/` is the only package that may use zustand stores.
4. `ai/` must not import from `renderer-react/` or `editor/`.

## Commits And PRs

1. Follow conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`.
2. Commit messages are lowercase with no trailing period.
3. One logical change per commit.
4. Reference GitHub Issues in PR descriptions, not commit messages.
5. Run `pnpm build` and `pnpm test` before pushing.
6. Run `pnpm lint` and `pnpm format` before pushing.

## Must Not Do

These are actions that agents MUST NOT perform:

1. MUST NOT merge PRs — wait for human review.
2. MUST NOT force-push or rewrite shared branch history.
3. MUST NOT commit secrets, tokens, or keys.
4. MUST NOT add dependencies without documenting the reason in the commit.
5. MUST NOT create placeholder or stub code without a linked Issue.
6. MUST NOT deviate from the spec without updating the spec first.
7. MUST NOT bypass the action model for any state mutation.
8. MUST NOT invent new spec documents without explicit approval.

## Key Spec References

When implementing, reference these documents in order:

| Priority | Document | What it defines |
|------|------|------|
| 1 | `docs/spec/domain-model.md` | All core types |
| 2 | `docs/spec/runtime-engine.md` | Scene runtime actions and handlers |
| 3 | `docs/spec/document-runtime.md` | Document actions and handlers |
| 4 | `docs/spec/implementation-stack.md` | Toolchain and directory layout |
| 5 | `docs/spec/history-and-undo-redo.md` | Undo/redo contracts |
| 6 | `docs/spec/renderer-contract.md` | Renderer API |
| 7 | `docs/spec/testing-and-fixtures.md` | Test strategy and fixtures |
| 8 | `docs/adr/` | Accepted architecture decisions |
