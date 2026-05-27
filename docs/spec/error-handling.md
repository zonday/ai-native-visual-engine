# Error Handling

## 1. Scope

This document defines the error taxonomy, propagation model, and recovery strategies across the engine stack: from runtime handlers through middleware and command buses to the editor UI.

## 2. Error Taxonomy

Every error in the engine carries a structured code.

```ts
export interface EngineError {
  code: string
  message: string
  severity: ErrorSeverity
  domain: ErrorDomain
  recoverable: boolean
  context?: Record<string, unknown>
}

export type ErrorSeverity = 'fatal' | 'error' | 'warning'

export type ErrorDomain =
  | 'document'
  | 'scene'
  | 'compiler'
  | 'renderer'
  | 'plugin'
  | 'import-export'
  | 'collaboration'
  | 'validation'
```

### 2.1 Severity Definitions

| Severity | Meaning | Default Behavior |
|------|------|------|
| `fatal` | The operation cannot proceed; the current state may be corrupted | Block the action, surface to UI, prevent further mutations until resolved |
| `error` | The action is rejected but the document remains in a valid state | Block the action, surface to UI, allow retry or alternative action |
| `warning` | The action succeeded but with caveats | Allow the action, surface to UI as non-blocking notification |

### 2.2 Error Codes

Error codes follow the pattern `<domain>.<category>`.

| Code | Domain | Severity | Meaning |
|------|------|------|------|
| `scene.node-not-found` | scene | error | Target node ID does not exist |
| `scene.invalid-parent` | scene | error | Parent node does not exist or cannot accept this child |
| `scene.cycle-detected` | scene | error | Move would create a parent-child cycle |
| `scene.root-mutation` | scene | error | Attempted to remove or reparent the root node |
| `scene.invalid-geometry` | scene | error | Layout values are out of allowed bounds |
| `scene.rotate-not-allowed` | scene | error | Node layout mode or plugin does not support rotation |
| `scene.batch-item-failed` | scene | error | A child action inside batch-actions failed |
| `scene.transaction-failed` | scene | error | A transaction's applyActions phase failed; the transaction is rolled back |
| `scene.transaction-validation-failed` | scene | error | Post-transaction validation failed; the transaction is rolled back |
| `scene.transaction-nested-depth-exceeded` | scene | error | Nested transaction depth exceeds the maximum allowed (default 8) |
| `scene.transaction-rollback-failed` | scene | fatal | A transaction rollback itself failed; state may be inconsistent |
| `document.page-not-found` | document | error | Referenced page does not exist |
| `document.duplicate-page-id` | document | error | Page ID already exists in the document |
| `document.duplicate-route` | document | error | Route already assigned to another page |
| `document.duplicate-scene-id` | document | error | Scene ID already referenced by another page |
| `document.invalid-theme` | document | error | Referenced theme does not exist |
| `compiler.invalid-intent` | compiler | error | Semantic action payload is malformed |
| `compiler.constraint-violation` | compiler | error | Generated plan violates a semantic or layout constraint |
| `compiler.unknown-component` | compiler | error | Requested component type not in plugin registry |
| `validation.action-schema-mismatch` | validation | error | Action payload fails Zod validation |
| `validation.document-schema-mismatch` | validation | fatal | Document structure fails schema validation on import |
| `validation.referential-broken` | validation | error | A reference resolves to a missing object |
| `renderer.unknown-plugin` | renderer | warning | Scene references a plugin type not in the registry |
| `renderer.render-failure` | renderer | error | A component renderer threw during rendering |
| `import.invalid-format` | import-export | error | Imported payload does not match the expected schema |
| `import.unrecoverable` | import-export | fatal | Imported document cannot be repaired |
| `collaboration.sync-failed` | collaboration | warning | A remote sync operation failed; will retry |
| `collaboration.merge-conflict` | collaboration | warning | Concurrent edits produced a non-trivial semantic conflict |

## 3. Error Propagation

Errors bubble from the point of detection to the editor UI through the middleware pipeline.

```text
Handler throws/fails
  -> CommandBus wraps in DispatchResult with error
  -> Middleware annotates with context (stage, action type, nodeId)
  -> CommandBus returns DispatchResult to caller
  -> Editor UI interprets error and surfaces to user
```

### 3.1 Runtime Error

```ts
export interface RuntimeError extends EngineError {
  domain: 'scene'
  actionType?: string
  nodeId?: NodeId
}
```

Propagation in the scene runtime pipeline:

1. Handler detects invalid state or precondition.
2. Handler returns structured error via `DispatchResult`.
3. Middleware annotates the error with pipeline stage context.
4. CommandBus returns the annotated result.
5. Editor UI reads `DispatchResult.error` and decides on presentation.

### 3.2 Document Error

```ts
export interface DocumentRuntimeError extends EngineError {
  domain: 'document'
  actionType?: string
  pageId?: PageId
}
```

Propagation mirrors the scene runtime pipeline through `DocumentDispatchResult`.

### 3.3 Compiler Error

```ts
export interface CompilerDiagnostic {
  level: 'error' | 'warning'
  code: string
  message: string
}
```

Compiler errors are returned inline in `SemanticCompileResult.diagnostics`.

1. Each pipeline stage may append diagnostics.
2. A stage that emits an `'error'`-level diagnostic halts further stages.
3. The final `SemanticCompileResult` aggregates all stage diagnostics.
4. The editor UI maps diagnostics to the relevant location (page, node, theme).

### 3.4 Renderer Error

Renderer errors are caught at the component boundary.

1. Each component renderer is wrapped in an error boundary.
2. A renderer error for a single node does not crash the full render tree.
3. The failed node is replaced with an error placeholder rendering the error code and message.
4. The error is surfaced to the editor UI as a non-blocking warning.

```ts
export interface RendererError extends EngineError {
  domain: 'renderer'
  nodeId: NodeId
  componentType: string
}
```

## 4. Recovery Strategies

### 4.1 Action-Level Recovery

For `error`-severity failures on individual actions:

1. The action is rejected.
2. The document and scene remain in their pre-action state.
3. The editor UI displays the error and allows the user to correct and retry.
4. The undo stack is not modified.

### 4.2 Batch And Transaction Recovery

For `batch-actions` or transaction failures:

1. If any child action fails during `applyActions`, the entire batch/transaction is rolled back.
2. The document and scene are restored to pre-batch/pre-transaction state.
3. The failed child action's error is surfaced.
4. The remaining valid child actions do not take effect.
5. For transactions, rollback restores the pre-state snapshot captured at `beginTransaction`.
6. If rollback itself fails (`scene.transaction-rollback-failed`), the state may be inconsistent and the editor should surface a fatal error.

### 4.3 Load Recovery

For document load failures, see `bootstrap-and-lifecycle.md` §6.

1. Damaged pages are isolated in a read-only recovery view.
2. Healthy pages remain editable.
3. The user may discard or attempt to repair damaged pages.

### 4.4 Import Recovery

For import failures:

1. Schema validation errors are surfaced with source location.
2. Missing plugin types produce warnings but do not block import.
3. Unrecoverable import failures surface all diagnostics and produce no partial document.

## 5. Error Rendering In Editor

The editor UI must render errors consistently.

### 5.1 Error Toast

For transient, non-blocking errors:

1. Display a toast notification with the error message.
2. Auto-dismiss after a short duration (default 5 seconds).
3. The user may click to expand details.

### 5.2 Inline Error Marker

For errors tied to a specific node or page:

1. Render an error indicator on the affected node in the canvas.
2. Highlight the affected entry in the layers panel or page list.
3. Show the full error details in the inspector panel.

### 5.3 Modal Error

For `fatal`-severity errors:

1. Display a modal dialog blocking further editing.
2. Show the full error with recovery options.
3. Offer to reload the document, discard changes, or export diagnostics.

## 6. Testing Contract

See `testing-and-fixtures.md` for error handling tests. Key scenarios:

1. Every action type rejects gracefully with the correct error code when preconditions fail.
2. Batch action rollback is complete and leaves no partial state.
3. A single renderer failure does not crash the full editor.
4. Import produces structured diagnostics for every recoverable issue.
5. Collaboration sync failures are retried without data loss.

## 7. Relationship To Other Specs

- `domain-model.md`: `NodeId`, `PageId`, scene invariants
- `runtime-engine.md`: `RuntimeError`, `DispatchResult`, handler failure policy
- `document-runtime.md`: `DocumentRuntimeError`, `DocumentDispatchResult`
- `semantic-system.md`: `CompilerDiagnostic`, compiler failure contract
- `bootstrap-and-lifecycle.md`: load and import recovery
- `renderer-contract.md`: renderer error boundaries
- `plugin-system.md`: unknown plugin handling
