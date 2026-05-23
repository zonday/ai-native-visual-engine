# Document Runtime

## 1. Scope

This document defines the execution model for document-level mutations such as page creation, removal, reordering, and route updates.

Scene runtime actions mutate one page scene. Document actions mutate the multi-page document itself.

## 2. Principles

Every document action must be:

1. deterministic
2. replayable
3. reversible
4. atomic
5. serializable

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
  themeId: string
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
4. `remove-page` removes the `Page` record and its referenced persisted scene in one atomic transaction.
5. `reorder-page` changes only page ordering and must not mutate scene content.
6. `update-page-route` must maintain route uniqueness across the document.
7. `set-document-theme` updates `VisualDocument.activeThemeId` and must reference an existing theme.
8. `set-page-theme` updates or clears `Page.themeId` and must reference an existing theme when set.
9. `batch-document-actions` commits as one history entry and must rollback fully if any child action fails.

## 5. Route Canonicalization

Route validation and uniqueness use the canonical route form.

Rules:

1. routes are path-like strings expressed in normalized lowercase form
2. routes must start with `/`
3. leading and trailing whitespace is trimmed before validation
4. an empty route is invalid unless the product later defines an explicit homepage convention
5. duplicate canonical routes are forbidden
6. if normalization changes the input value, the normalized route is the stored value

## 6. History Policy

The engine keeps document history as a domain separate from scene history.

Rules:

1. document history entries contain only document actions
2. scene history entries contain only scene runtime actions
3. the engine does not require a merged document-plus-scene timeline
4. MVP editor UI should route undo and redo by current interaction focus, such as page list operations using document history and canvas operations using scene history

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

1. accept document actions from the editor, semantic compiler, or collaboration sync
2. pass actions through middleware
3. route actions to document handlers
4. return updated document state or structured failure
5. on failure, return the pre-dispatch document state with no partial mutations applied

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

1. handlers are pure relative to input state
2. handlers must not mutate the input document in place
3. side effects such as logging and remote sync belong in middleware

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
export interface DocumentHistoryState {
  undoStack: DocumentHistoryEntry[]
  redoStack: DocumentHistoryEntry[]
}

export interface DocumentHistoryEntry {
  action: DocumentAction
  inverseAction?: DocumentAction
  timestamp: number
  actorId?: string
}

export interface DocumentEventLog {
  initialDocument: VisualDocument
  actions: DocumentAction[]
}
```

Rules:

1. document history is independent of scene history but may share the same infrastructure implementation
2. replaying `DocumentEventLog` must rebuild the same page list and persisted scene mapping
3. a product may combine document and scene histories in one UI timeline, but the engine model keeps them as distinct domains

## 11. Relationship To Scene Runtime

Document actions and scene runtime actions are parallel domains.

Recommended execution order when both are produced by the semantic compiler:

1. dispatch required document actions first
2. resolve resulting page and scene IDs
3. dispatch scene runtime actions against the target scene

Example:

1. `create-dashboard` with no `pageId` may emit `create-page`
2. the compiler then emits scene runtime actions to populate the new page scene

## 12. Collaboration

Document actions must participate in collaboration just like scene runtime actions.

Shared durable state:

- page records
- page ordering
- page routes
- persisted scenes

Ephemeral presence state is not modeled as document actions.
