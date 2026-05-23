# Bootstrap And Lifecycle

## 1. Scope

This document defines initialization paths for a new document, the session lifecycle, and the bridge from persisted state to an active editing session.

## 2. Document Initialization

### 2.1 New Document

The engine must support creating a new empty document from scratch.

```ts
export interface NewDocumentOptions {
  title?: string
  themeId?: string
  route?: string
}

export function createNewDocument(
  options?: NewDocumentOptions
): VisualDocument
```

Rules:

1. A new document contains one initial `Page` with one empty `PersistedSceneGraph`.
2. The engine assigns unique IDs for the document, the initial page, and the initial scene.
3. The initial scene is added to `VisualDocument.scenes` mapped by the page's `sceneId`.
4. The initial page may optionally carry a `route`.
5. If a `themeId` is provided, it is set as `VisualDocument.activeThemeId` after validation.
6. The returned document is ready for `create-node` runtime actions.

### 2.2 Empty Scene

```ts
export function createEmptyScene(): PersistedSceneGraph
```

Rules:

1. Contains a single root node with `rootId` self-referencing.
2. `nodes` contains only the root entry.
3. `version` starts at `0`.
4. No selection, viewport, or session overlays are stored.

## 3. Session Lifecycle

The editing lifecycle from document load to save follows a predictable sequence.

### 3.1 Open Document

```text
Persisted DocumentSnapshot
  -> Validate schema
  -> Materialize scenes into in-memory SceneGraph instances
  -> Initialize EditorSessionState
  -> Ready for editing
```

Rules:

1. Schema validation must run before any scenes are materialized.
2. If validation fails, the document must not enter an editable state.
3. The active page is set explicitly or defaults to the first page.
4. `selection` and `viewport` start empty on session open.

### 3.2 Active Page Switch

```ts
export interface ActivatePageOptions {
  pageId: PageId
}
```

Rules:

1. Commit any pending actions on the current page before switching.
2. Materialize the new page's `PersistedSceneGraph` into an in-memory `SceneGraph`.
3. Reset session state for the new page.
4. If the target page does not exist, the switch fails with a structured error.

### 3.3 Save And Close

```text
In-memory SceneGraph
  -> Produce DocumentSnapshot
  -> Serialize
  -> Persist
```

Rules:

1. Session overlays are stripped before saving.
2. Only `PersistedSceneGraph` content enters `DocumentSnapshot.scenes`.
3. The save operation must be idempotent for a given state.
4. After close, the in-memory `SceneGraph` instances are discarded.

## 4. Document Lifecycle Events

The engine should emit lifecycle hooks at key transitions.

```ts
export type DocumentLifecycleEvent =
  | { type: 'document-opened'; snapshot: DocumentSnapshot }
  | { type: 'page-activated'; pageId: PageId }
  | { type: 'page-deactivated'; pageId: PageId }
  | { type: 'document-saved'; snapshot: DocumentSnapshot }
  | { type: 'document-closed' }
```

Rules:

1. Lifecycle events are not durable document actions.
2. They fire before and after the corresponding state transition.
3. Plugins may subscribe to lifecycle events for custom side effects.

## 5. Import And Export

### 5.1 Import

The engine must accept an external representation and produce a valid `VisualDocument`.

```ts
export interface ImportResult {
  ok: boolean
  document?: VisualDocument
  diagnostics?: CompilerDiagnostic[]
}
```

Rules:

1. The import pipeline validates schema before state materialization.
2. Missing plugin types do not block import; they are preserved with `MissingPluginPlaceholder` behavior.
3. Invalid geometry triggers a diagnostic but does not block import unless the structure is unrecoverable.

### 5.2 Export

```ts
export interface ExportOptions {
  targetPageIds?: PageId[]
  includeThemes?: boolean
  includeAssets?: boolean
}
```

Rules:

1. Export strips session overlays.
2. Only requested pages are included; default is all pages.
3. The export artifact is a serialized `DocumentSnapshot`.

## 6. Error Recovery During Load

If a persisted document cannot be fully loaded:

1. The engine must surface structured diagnostics rather than failing silently.
2. Damaged pages should be isolated so the rest of the document remains editable.
3. A damaged page may enter a read-only recovery view.
4. The editor must offer a path to discard or repair the damaged page.

```ts
export interface DocumentLoadResult {
  ok: boolean
  document?: VisualDocument
  damagedPageIds?: PageId[]
  diagnostics: CompilerDiagnostic[]
}
```

## 7. Relationship To Other Specs

- `domain-model.md`: `VisualDocument`, `PersistedSceneGraph`, `SceneGraph`, `EditorSessionState`
- `document-runtime.md`: `DocumentAction`, `DocumentEventLog`
- `runtime-engine.md`: `RuntimeAction`, `SceneEventLog`
- `plugin-system.md`: plugin lifecycle hooks
- `persistence-and-serialization.md`: serialization format and storage strategy
