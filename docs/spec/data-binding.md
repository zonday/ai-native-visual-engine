# Data Binding

## 1. Scope

This document defines the data binding model: how scene nodes reference external data sources, how variables are resolved, and the lifecycle of a binding from creation through re-resolution to unbinding.

## 2. Binding Model

A binding connects a scene node to a data source.

```ts
export interface Binding {
  key: string
  source: string
  path?: string
  transform?: string
}
```

### 2.1 Field Semantics

| Field | Meaning | Example |
|------|------|------|
| `key` | Target property on the node to bind | `chart.series`, `text.content` |
| `source` | Data source identifier | `dataset:sales-q1`, `variable:company-name` |
| `path` | Optional JSON-path into the source payload | `data.rows[0].value` |
| `transform` | Optional named transform to apply | `currency`, `percent`, `truncate-10` |

### 2.2 Binding Examples

```ts
// Bind a chart series to a dataset
{ key: 'chart.series', source: 'dataset:sales-q1', path: 'monthly' }

// Bind a text node to a variable
{ key: 'text.content', source: 'variable:page-title' }

// Bind with a transform
{ key: 'text.content', source: 'dataset:revenue', path: 'total', transform: 'currency' }
```

## 3. Data Source Registry

The engine maintains a registry of available data sources.

```ts
export interface DataSourceRegistry {
  getDataset(id: string): Promise<Dataset | undefined>
  getVariable(id: string): Promise<unknown | undefined>
  resolveValue(source: string, path?: string): Promise<unknown>
  subscribe(
    source: string,
    path: string | undefined,
    callback: (value: unknown) => void
  ): () => void
}

export interface Dataset {
  id: string
  name: string
  schema: DatasetSchema
  rows: Record<string, unknown>[]
}

export interface DatasetSchema {
  columns: { key: string; type: 'string' | 'number' | 'date' | 'boolean' }[]
}
```

Rules:

1. The data source registry is pluggable.
2. The MVP may use an in-memory registry with pre-loaded fixtures.
3. Production backends may connect to external APIs, databases, or file stores.
4. Every data source has a unique `id`.

## 4. Variable Model

Variables are document-scoped values referenced by bindings.

```ts
export interface Variable {
  id: string
  name: string
  type: 'string' | 'number' | 'boolean' | 'json'
  value?: unknown
}
```

Variables are owned by `VisualDocument.variables` (see `domain-model.md`).

Rules:

1. Variables are resolved synchronously at binding resolution time.
2. A variable with no `value` resolves to `undefined`.
3. Variables may be updated through `update-props`-like mutation; dedicated variable mutation actions are a post-MVP concern.

## 5. Binding Lifecycle

### 5.1 Create

A binding is created when a scene node is created or updated with bindings present.

```text
create-node with bindings
  or update-bindings on existing node
  -> register binding in node's bindings[]
  -> resolve binding immediately
  -> subscribe to data source changes
```

### 5.2 Resolve

The engine resolves a binding to a concrete value.

```ts
export interface ResolvedBinding {
  binding: Binding
  value: unknown
  resolvedAt: number
  status: 'ok' | 'error' | 'pending'
  error?: string
}
```

Resolution order:

1. Look up the `source` in the `DataSourceRegistry`.
2. If the source is not found, mark status as `error`.
3. Apply `path` traversal on the source payload.
4. Apply `transform` if present.
5. Store resolved value in `ResolvedBinding`.

### 5.3 Re-resolve

Bindings re-resolve when their data source changes.

1. The `DataSourceRegistry.subscribe` callback fires on source change.
2. All bindings referencing that source are re-resolved.
3. Re-resolved values flow to the renderer for the affected nodes.
4. Re-resolution does not produce a runtime action; it is a read-only pipeline.

### 5.4 Unbind

A binding is removed when:

1. The hosting node is deleted.
2. `update-bindings` replaces the bindings array with one that excludes the binding.
3. The subscription from create is cleaned up.

## 6. Binding And The Renderer

The renderer receives resolved bindings through the scene graph at render time.

```text
SceneNode.bindings[]
  -> Resolve each binding
  -> Map resolved values to node.props using binding.key
  -> Render node with resolved props
```

Rules:

1. The renderer does not call the data source registry directly.
2. Resolution happens before the render pass.
3. If a binding is in `error` status, the renderer must degrade gracefully (e.g., show placeholder text, empty chart).
4. Resolved values are never written back into persisted scene state.

## 7. Binding And The Compiler

The semantic compiler may generate bindings as part of action expansion.

```text
AI creates a chart
  -> compiler selects dataset
  -> compiler generates Binding { key, source, path }
  -> binding is included in the create-node action
```

Rules:

1. The compiler must validate that the referenced dataset exists before generating a binding.
2. If the dataset is not registered, the compiler emits a diagnostic.
3. The compiler may generate default transforms based on column type.

## 8. Error Handling

Binding errors are non-blocking.

1. A binding that fails to resolve enters `status: 'error'` with a descriptive error string.
2. The renderer shows a degraded view, not a crash.
3. Binding errors are surfaced to the editor as warnings.
4. The editor may provide an inline UI to fix the binding source or path.

## 9. Post-MVP Extensions

Future versions may add:

1. Expression-based transforms (e.g., `transform: '{value} * 1.2'`).
2. Multi-source bindings that combine multiple datasets.
3. Parameterized dataset queries with user-provided filter values.
4. Real-time streaming data source subscriptions.

## 10. Relationship To Other Specs

- `domain-model.md`: `SceneNode.bindings`, `Binding`, `Variable`, `VisualDocument.variables`
- `runtime-engine.md`: `update-bindings`, scene node mutation
- `semantic-system.md`: compiler binding generation
- `renderer-contract.md`: render-time binding resolution
- `error-handling.md`: binding error codes and recovery
