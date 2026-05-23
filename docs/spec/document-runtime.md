# Document Runtime

## 1. Scope

This document defines the execution model for document-level mutations such as page creation, removal, reordering, and route updates.

Scene runtime actions mutate one page scene. Document actions mutate the multi-page document itself.

## 2. Principles

Every document action must be:

1. Deterministic
2. Replayable
3. Reversible
4. Atomic
5. Serializable

The same standards that apply to scene runtime actions also apply to document actions.

## 3. Document Action Types

```ts
export type DocumentAction =
  | CreatePageAction
  | RenamePageAction
  | RemovePageAction
  | ReorderPageAction
  | UpdatePageRouteAction
  | SetDocumentThemeAction
  | SetPageThemeAction
  | BatchDocumentActions

export interface CreatePageAction {
  type: 'create-page'
  page: Page
  scene: PersistedSceneGraph
}

export interface RenamePageAction {
  type: 'rename-page'
  pageId: PageId
  name: string
}

export interface RemovePageAction {
  type: 'remove-page'
  pageId: PageId
}

export interface ReorderPageAction {
  type: 'reorder-page'
  pageId: PageId
  index: number
}

export interface UpdatePageRouteAction {
  type: 'update-page-route'
  pageId: PageId
  route: string
}

export interface SetDocumentThemeAction {
  type: 'set-document-theme'
  themeId?: string
}

export interface SetPageThemeAction {
  type: 'set-page-theme'
  pageId: PageId
  themeId?: string
}

export interface BatchDocumentActions {
  type: 'batch-document-actions'
  actions: DocumentAction[]
}
```

## 4. Action Rules

1. `create-page` adds both a `Page` record and its persisted scene in one atomic transaction.
2. `create-page.page.sceneId` is the canonical key used to insert `create-page.scene` into `VisualDocument.scenes`.
3. `create-page` must validate unique `page.id`, unique `page.sceneId`, and valid route uniqueness when a route is present.
4. `remove-page` removes the `Page` record and its referenced persisted scene in one atomic transaction. Must reject if the page does not exist.
5. `rename-page` updates the page name. Must reject if the page does not exist.
6. `reorder-page` changes only page ordering and must not mutate scene content. `index` is clamped to `[0, pages.length - 1]`; out-of-bounds values are rejected.
7. `update-page-route` must maintain route uniqueness across the document. Must reject if the page does not exist.
8. `set-document-theme` updates or clears `VisualDocument.activeThemeId` and must reference an existing theme when set.
9. `set-page-theme` updates or clears `Page.themeId` and must reference an existing theme when set.
10. `batch-document-actions` commits as one history entry and must rollback fully if any child action fails. Nested batch actions are flattened before execution.

## 5. Route Canonicalization

Route validation and uniqueness use the canonical route form.

Rules:

1. Routes are path-like strings expressed in normalized lowercase form.
2. Routes must start with `/`.
3. Leading and trailing whitespace is trimmed before validation.
4. An empty route is invalid unless the product later defines an explicit homepage convention.
5. Duplicate canonical routes are forbidden.
6. If normalization changes the input value, the normalized route is the stored value.

## 6. History Policy

The engine keeps document history as a domain separate from scene history.

Rules:

1. Document history entries contain only document actions.
2. Scene history entries contain only scene runtime actions.
3. The engine does not require a merged document-plus-scene timeline.
4. MVP editor UI should route undo and redo by current interaction focus, such as page list operations using document history and canvas operations using scene history.

## 7. Document Command Bus

```ts
export interface DocumentCommandBus {
  dispatch(action: DocumentAction): DocumentDispatchResult
}

export interface DocumentDispatchResult {
  ok: boolean
  document: VisualDocument
  error?: DocumentRuntimeError
}

export interface DocumentRuntimeError {
  code: string
  message: string
  actionType?: string
  pageId?: PageId
}
```

Responsibilities:

1. Accept document actions from the editor, semantic compiler, or collaboration sync.
2. Pass actions through middleware.
3. Route actions to document handlers.
4. Return updated document state or structured failure.
5. On failure, return the pre-dispatch document state with no partial mutations applied.

## 8. Handler Contract

```ts
export type DocumentHandler<TAction extends DocumentAction> = (
  document: VisualDocument,
  action: TAction,
  context: DocumentRuntimeContext
) => VisualDocument

export interface DocumentRuntimeContext {
  now: () => number
  actorId?: string
}
```

Rules:

1. Handlers are pure relative to input state.
2. Handlers must not mutate the input document in place.
3. Side effects such as logging and remote sync belong in middleware.

## 9. Middleware Pipeline

Recommended pipeline:

```text
Document Action
  -> Logger
  -> Validator
  -> Undo/History
  -> Collaboration
  -> Handler
```

The middleware concepts mirror the scene runtime pipeline so that document and scene actions can share implementation patterns.

## 10. History And Event Log

```ts
export interface DocumentEventLogEntry {
  action: DocumentAction
  actorId?: string
  timestamp: number
}

export interface DocumentEventLog {
  initialDocument: VisualDocument
  actions: DocumentEventLogEntry[]
}
```

Rules:

1. Document history is independent of scene history but may share the same infrastructure implementation.
2. Replaying `DocumentEventLog` must rebuild the same page list and persisted scene mapping.
3. A product may combine document and scene histories in one UI timeline, but the engine model keeps them as distinct domains.
4. Post-MVP UI may add a merged activity timeline for inspection, but that does not imply merged undo and redo semantics.

## 11. Relationship To Scene Runtime

Document actions and scene runtime actions are parallel domains.

Recommended execution order when both are produced by the semantic compiler:

1. Dispatch required document actions first.
2. Resolve resulting page and scene IDs.
3. Dispatch scene runtime actions against the target scene.

Example:

1. `create-dashboard` with no `pageId` may emit `create-page`.
2. The compiler then emits scene runtime actions to populate the new page scene.

## 12. Collaboration

Document actions must participate in collaboration just like scene runtime actions.

Shared durable state:

- page records
- page ordering
- page routes
- persisted scenes

Ephemeral presence state is not modeled as document actions.
