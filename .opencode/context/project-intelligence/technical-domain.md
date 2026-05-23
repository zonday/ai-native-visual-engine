<!-- Context: project-intelligence/technical | Priority: critical | Version: 1.0 | Updated: 2026-05-23 -->

# Technical Domain

**Purpose**: Defines the preferred frontend stack and coding patterns for this project's eventual implementation.
**Last Updated**: 2026-05-23

## Quick Reference

**Audience**: Developers and AI agents
**Update Triggers**: Stack changes, component pattern changes, naming changes, security updates

## Primary Stack

| Layer | Technology | Notes |
|------|------|------|
| Build Tool | Vite | Default app/runtime bundler |
| Language | TypeScript | Use strict typing by default |
| UI | React | Functional components only |
| Styling | Tailwind CSS | Utility-first styling baseline |
| Component Primitives | shadcn/ui | Default primitive/component layer |
| Database | n/a | No database pattern defined yet |

## Core Patterns

Concept: Prefer a lightweight React architecture with typed props, local state first, and composition over boolean-heavy component APIs.

- Use functional React components only.
- Use TypeScript strict mode and explicit prop typing.
- Prefer composition over prop flags for variant-heavy UI.
- Use Tailwind for styling and shadcn/ui for shared primitives.
- Keep state local first; lift or centralize only when needed.

```tsx
type PanelHeaderProps = {
  title: string
  actions?: React.ReactNode
}

export function PanelHeader({ title, actions }: PanelHeaderProps) {
  return <div className="flex items-center justify-between">{title}{actions}</div>
}
```

Ref: `docs/spec/README.md`

## API Pattern

Concept: No API layer pattern is defined yet for this repository.

- Treat API conventions as undecided until implementation starts.
- Do not invent backend conventions in generated code.
- Add a real endpoint example once the app includes an API surface.

```ts
// No project API pattern defined yet.
// Add a real endpoint example when the app has one.
export {}
```

Ref: `README.md`

## Naming Conventions

Concept: Use standard React and TypeScript naming that keeps files predictable and components easy to scan.

- Files use `kebab-case`.
- Components and types use `PascalCase`.
- Functions and hooks use `camelCase`; hooks start with `use`.
- Constants use `SCREAMING_SNAKE_CASE`.
- Database naming is `n/a` until persistence exists.

```txt
panel-header.tsx
EditorCanvas
buildExecutionPlan
useEditorState
DEFAULT_GRID_COLUMNS
```

Ref: `docs/spec/editor-interaction.md`

## Code Standards

Concept: Keep implementation simple, typed, and feature-oriented, with minimal abstraction unless reuse is proven.

- TypeScript strict mode.
- Functional React components only.
- Prefer composition over prop flags.
- Tailwind for styling; avoid ad hoc CSS unless needed.
- Use shadcn/ui as the default primitive layer.
- Prefer explicit prop types over `any`.
- Co-locate component, hook, and schema by feature when practical.
- Use aliased imports only if project config adds them.

```tsx
type InspectorProps = {
  selectedId: string | null
}

export function Inspector({ selectedId }: InspectorProps) {
  return <aside className="border-l p-4">{selectedId ?? 'No selection'}</aside>
}
```

Ref: `docs/spec/runtime-engine.md`

## Security Requirements

Concept: Validate all external data at boundaries and avoid unsafe rendering patterns in the React frontend.

- Validate all external input.
- Sanitize user-provided HTML or rich text before rendering.
- Never trust client-only authorization state.
- Keep secrets out of frontend bundles.
- Avoid `dangerouslySetInnerHTML` unless sanitized.
- Validate URL and query params before use.
- Prefer typed API contracts at boundaries.

```tsx
type SafePreviewProps = {
  text: string
}

export function SafePreview({ text }: SafePreviewProps) {
  return <pre className="whitespace-pre-wrap">{text}</pre>
}
```

Ref: `docs/spec/constraints-and-validation.md`

## 📂 Codebase References

- `README.md`: repository entry point and project framing
- `docs/spec/README.md`: spec index for implementation planning
- `docs/spec/runtime-engine.md`: runtime action and handler expectations
- `docs/spec/editor-interaction.md`: editor interaction model and state semantics
- `docs/spec/constraints-and-validation.md`: validation and safety constraints
- Current status: implementation source files for Vite/React/Tailwind/shadcn are not present in this repo yet
