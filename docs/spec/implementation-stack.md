# Implementation Stack

## 1. Scope

This document defines the concrete engineering toolchain, package structure, directory layout, and runtime environment for implementing the AI Native Visual Engine. It is the single source of truth for every engineering decision a developer or AI agent needs to start coding.

## 2. Package Architecture

The project uses a **pnpm monorepo** with Turborepo for task orchestration.

### 2.1 Package Manager

```
pnpm >= 11.2
```

Reasons:

1. Strict dependency isolation prevents phantom imports.
2. Workspace protocol (`workspace:*`) keeps internal package versions in sync.
3. Fast installs with content-addressable storage.
4. Turborepo's first-class pnpm integration.

### 2.2 Task Orchestration

```
turborepo >= 2.9
```

Pipeline configuration in `turbo.json`:

```json
{
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**"] },
    "test": { "dependsOn": ["build"] },
    "typecheck": { "dependsOn": ["^build"] },
    "lint": {},
    "format": {}
  }
}
```

### 2.3 Package Structure

```
packages/
  core/             # @ai-native/core — engine logic
  renderer-react/   # @ai-native/renderer-react — React renderer
  editor/           # @ai-native/editor — editor UI shell
  ai/               # @ai-native/ai — AI tool-call integration
```

Each package ships with its own `package.json`, `tsconfig.json`, and `src/` directory. Internal dependencies use `workspace:*`.

## 3. Build Toolchain

### 3.1 Library Bundler

```
tsdown >= 0.22
```

Core packages (`core/`, `ai/`) use `tsdown` for building.

```json
{
  "build": "tsdown"
}
```

Reasons:

1. Rolldown-based, same engine as Vite 8 — unified build toolchain across the entire monorepo.
2. Fast `.d.ts` generation via `rolldown-plugin-dts`.
3. Minimal config surface, zero-config by default.
4. Maintained by the same team as tsup.

### 3.2 Web Dev Server And Bundler

```
vite >= 8.0
```

Web packages (`renderer-react/`, `editor/`) use Vite for development and production builds.

```json
{
  "dev": "vite",
  "build": "vite build"
}
```

Reasons:

1. Native ESM dev server with instant HMR.
2. Same ecosystem as vitest, shared config surface.
3. Built-in React Fast Refresh.
4. Rolldown-powered production builds.
5. PostCSS / Tailwind CSS integration out of the box.

### 3.3 TypeScript

```
TypeScript >= 5.6
```

Shared `tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "isolatedModules": true
  }
}
```

Per-package `tsconfig.json` extends the base:

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src"]
}
```

### 3.4 Linting And Formatting

```
biome >= 2.4
```

Single tool for both linting and formatting, replacing ESLint + Prettier.

```json
{
  "formatter": { "indentStyle": "space", "indentWidth": 2 },
  "linter": {
    "rules": {
      "correctness": { "noUnusedVariables": "error" },
      "style": { "useConst": "error" }
    }
  }
}
```

Reasons:

1. Single dependency for format + lint.
2. Orders of magnitude faster than ESLint + Prettier.
3. Native TypeScript support without plugins.
4. Built-in import sorting.

### 3.5 Testing

```
vitest >= 4.1
```

```json
{
  "test": "vitest run",
  "test:watch": "vitest"
}
```

Reasons:

1. Native ESM, compatible with the Vite/turborepo ecosystem.
2. Built-in TypeScript support.
3. Snapshot testing, fixtures, and mocking included.
4. Same config surface as Vite if needed for browser tests.

For DOM-dependent renderer tests: `@vitest/browser` with Playwright.

### 3.5 React

```
React >= 19.2
```

The editor shell and renderer use React 19 for the Server Components primitives (if needed later) and the improved ref handling and hooks. No framework (Next.js, Remix) is required — this is a client-side engine and editor.

## 4. State Management

```
zustand
```

Editor state and engine state in the editor package use Zustand.

```ts
import { create } from 'zustand'

export const useEditorStore = create<EditorState>((set) => ({
  activePageId: null,
  setActivePage: (id) => set({ activePageId: id }),
}))
```

Reasons:

1. Minimal boilerplate, works outside React.
2. No provider wrapper needed.
3. Selective re-rendering by default.
4. Middleware support for persistence, devtools, immer.

Core engine packages (`core/`, `renderer-react/`, `ai/`) are **framework-agnostic** — they expose pure TypeScript interfaces. Zustand is only used in the `editor/` package.

## 5. Graph And Layout

```
dagre
```

Grid layout engine and graph algorithms use `dagre` for layout computation.

```ts
import { graphlib, layout } from 'dagre'

const g = new graphlib.Graph()
g.setNode('a', { width: 200, height: 100 })
g.setEdge('a', 'b')
layout(g)
```

Reasons:

1. Battle-tested directed graph layout.
2. Produces deterministic coordinates.
3. Lightweight with zero rendering dependencies.

## 6. Collaboration Transport

```
yjs + y-websocket
```

See `collaboration-framework.md` for the architecture decision.

```
yjs
y-websocket
lib0
```

Reasons:

1. CRDT-based conflict resolution.
2. Built-in awareness protocol for presence.
3. Works offline with automatic re-sync.
4. Transport-agnostic; WebSocket for MVP.

## 7. UI Primitives

```
shadcn/ui + Tailwind CSS
```

The editor shell uses:

```
tailwindcss >= 4.0
shadcn/ui (@base-ui/react primitives)
lucide-react
```

shadcn/ui components use `@base-ui/react` as the headless primitive layer, replacing older `@radix-ui/react-*` packages.

Reasons:

1. Consistent with `technical-domain.md` frontend standards.
2. Accessible by default via base-ui primitives.
3. Tree-shakeable — only ship what you use.
4. Tailwind utility classes keep editor CSS scoped.

## 8. Runtime Environment

### 8.1 Node.js

```
Node.js >= 22.13 LTS
```

Required for development tooling and test runner. The engine core has no Node.js dependency — it is isomorphic.

### 8.2 Browser Target

```
ES2022
Last 2 versions of Chrome, Firefox, Safari, Edge
```

The engine and editor are browser-first. No IE11 or legacy browser support.

### 8.3 Module Format

All packages ship **ESM only**. No CJS fallback.

```json
{
  "type": "module"
}
```

## 9. Directory Layout

```
ai-native-visual-engine/
  turbo.json
  tsconfig.base.json
  biome.json
  pnpm-workspace.yaml
  package.json

  packages/
    core/
      package.json
      tsconfig.json
      src/
        index.ts
        document/
          index.ts
          types.ts
          actions.ts
          command-bus.ts
          handlers/
            index.ts
            create-page.ts
            remove-page.ts
            rename-page.ts
            reorder-page.ts
            update-page-route.ts
            set-document-theme.ts
            set-page-theme.ts
            batch.ts
          middleware/
            logger.ts
            validator.ts
            undo-history.ts
            collaboration.ts
          event-log.ts
          history.ts
        scene/
          index.ts
          types.ts
          actions.ts
          command-bus.ts
          handlers/
            index.ts
            create-node.ts
            remove-node.ts
            move-node.ts
            update-layout.ts
            rotate-node.ts
            update-props.ts
            update-style.ts
            update-bindings.ts
            update-runtime.ts
            update-selection.ts
            batch.ts
          middleware/
            logger.ts
            validator.ts
            undo-history.ts
            collaboration.ts
          event-log.ts
          history.ts
        compiler/
          index.ts
          normalize.ts
          intent-expansion.ts
          constraint-precheck.ts
          layout-planning.ts
          action-expansion.ts
          validation.ts
          types.ts
        semantic/
          index.ts
          actions.ts
          types.ts
        constraints/
          index.ts
          structural.ts
          layout.ts
          semantic.ts
          types.ts
        plugins/
          index.ts
          registry.ts
          types.ts
        layout/
          index.ts
          free.ts
          absolute.ts
          flex.ts
          grid.ts
          grid-item.ts
          types.ts
        __fixtures__/
          single-page-empty.json
          multi-page-dashboard.json
          grid-layout-sample.json
          absolute-layout-sample.json
          unknown-plugin-node.json
          invalid-geometry-node.json
          theme-multi-page.json

    renderer-react/
      package.json
      tsconfig.json
      src/
        index.ts
        renderer.tsx
        context.ts
        node-renderer.tsx
        missing-plugin-placeholder.tsx
        layout/
          absolute.tsx
          flex.tsx
          grid.tsx
          grid-item.tsx
        selection/
          overlay.tsx
          marquee.tsx
        __fixtures__/
          simple-scene.json

    editor/
      package.json
      tsconfig.json
      src/
        index.ts
        Editor.tsx
        store.ts
        panels/
          page-list.tsx
          layers.tsx
          inspector.tsx
          theme-editor.tsx
        canvas/
          Canvas.tsx
          selection-overlay.tsx
          drag-preview.tsx
          resize-handles.tsx
        toolbar/
          index.tsx
        collaboration/
          presence-cursors.tsx
          presence-selections.tsx

    ai/
      package.json
      tsconfig.json
      src/
        index.ts
        tool-calls.ts
        schema-index.ts
        compiler.ts
```

## 10. CI Pipeline

Recommended CI steps (GitHub Actions):

```yaml
steps:
  - pnpm install --frozen-lockfile
  - pnpm run lint
  - pnpm run format --check
  - pnpm run typecheck
  - pnpm run build
  - pnpm run test
```

## 11. Deployment

The editor SPA is deployed to Cloudflare Pages. See `deployment.md` for the full strategy, CI pipeline with automatic preview deployments per PR, and environment variable configuration.

## 12. Versioning

All packages share a single version number. Initial version:

```
0.1.0
```

The version is bumped per the roadmap phase, not per package. Semantic versioning applies to the public API surface of each package, documented in its `README.md`.

## 13. Version Pinning

All packages are pinned to the following minimum versions. These represent the latest stable releases as of May 2026.

| Package | Minimum Version |
|------|------|
| pnpm | 11.2 |
| turborepo | 2.9 |
| typescript | 5.6 |
| vite | 8.0 |
| tsdown | 0.22 |
| react | 19.2 |
| react-dom | 19.2 |
| vitest | 4.1 |
| @vitest/browser | 4.1 |
| biome | 2.4 |
| zustand | 5.0 |
| tailwindcss | 4.3 |
| dagre | 0.8 |
| yjs | 13.6 |
| y-websocket | 2.1 |
| lib0 | 0.2 |
| lucide-react | latest |
| node | 22.13 LTS |

## 14. Relationship To Other Specs

- `roadmap.md`: phase-scoped delivery order and acceptance criteria
- `domain-model.md`: all core types implemented in `packages/core/`
- `renderer-contract.md`: renderer API implemented in `packages/renderer-react/`
- `testing-and-fixtures.md`: fixture locations in `__fixtures__/`
- `collaboration-framework.md`: Yjs dependency justification
