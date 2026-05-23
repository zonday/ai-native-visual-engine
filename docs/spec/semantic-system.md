# Semantic System

## 1. Scope

This document defines the AI-facing intent layer and the semantic compiler that translates intent into executable engine actions.

## 2. Hard Rule

AI is not allowed to generate or mutate raw `SceneGraph` directly.

AI may only output:

1. tool-call arguments
2. semantic actions
3. parameter values for approved semantic schemas

This prevents invalid structure generation and keeps runtime behavior inside deterministic engine boundaries.

## 3. Semantic Action Model

```ts
export type SemanticAction =
  | CreateDashboardAction
  | InsertChartAction
  | AutoLayoutAction
  | UpdateThemeIntentAction
```

### 3.1 create-dashboard

```ts
export interface CreateDashboardAction {
  type: 'create-dashboard'
  domain: 'sales' | 'finance' | 'marketing'
  style?: 'tech' | 'minimal' | 'dark'
  datasets?: string[]
  pageId?: PageId
}
```

### 3.2 insert-chart

```ts
export interface InsertChartAction {
  type: 'insert-chart'
  chartType: 'line' | 'bar' | 'pie'
  metric?: string
  dimension?: string
  targetNodeId?: NodeId
}
```

### 3.3 auto-layout

```ts
export interface AutoLayoutAction {
  type: 'auto-layout'
  scopeNodeId: NodeId
  strategy?: 'compact' | 'balanced' | 'presentation'
}
```

### 3.4 update-theme-intent

```ts
export interface UpdateThemeIntentAction {
  type: 'update-theme-intent'
  pageId?: PageId
  themeId?: string
  mode?: 'light' | 'dark'
  emphasis?: 'data-dense' | 'presentation' | 'executive'
}
```

This semantic intent targets the canonical theme ownership model:

1. `VisualDocument.activeThemeId` for document-wide theme changes
2. `Page.themeId` for page-specific overrides

The compiler should expand this intent into `set-document-theme` and/or `set-page-theme` document actions.

Semantic actions should be product-oriented, concise, and stable across renderer implementations.

## 4. Semantic Compiler Responsibilities

The semantic compiler converts intent into executable engine actions.

Pipeline:

```text
Semantic Action
  -> Normalize
  -> Intent Expansion
  -> Constraint Precheck
  -> Layout Planning
  -> Action Expansion
  -> Validation
  -> Execution Plan
```

## 5. Compiler Stage Definitions

### 5.1 Normalize

Purpose:

1. fill defaults
2. canonicalize input shape
3. resolve aliases

Example:

- missing style defaults to `minimal`
- dataset aliases are mapped to known dataset keys

Output:

```ts
export interface NormalizedSemanticIntent {
  type: string
  payload: Record<string, unknown>
}
```

### 5.2 Intent Expansion

Purpose:

Expand high-level semantic intent into a component plan.

Example for `create-dashboard`:

- root dashboard container
- header
- KPI row
- primary chart
- secondary table
- optional filter panel

Output:

```ts
export interface PlannedNode {
  type: string
  props?: Record<string, unknown>
  children?: PlannedNode[]
  preferredLayout?: Partial<Layout>
  semanticRole?: string
}
```

### 5.3 Constraint Precheck

Purpose:

Reject impossible plans before layout or runtime generation.

Examples:

- `insert-chart` target is not a valid container
- dark theme conflicts with unavailable text palette
- required KPI block missing from a dashboard template

### 5.4 Layout Planning

Purpose:

Assign container layout and child placement.

Responsibilities:

1. choose layout mode
2. determine grid geometry
3. assign item positions and spans
4. adapt to target container constraints

Output:

```ts
export interface LayoutPlan {
  root: PlannedNode
}
```

### 5.5 Action Expansion

Purpose:

Convert the plan into concrete document actions and runtime actions.

Example output:

- `create-node` root container
- `create-node` header
- `create-node` chart
- `update-layout` grid container
- `update-props` chart series config

If the semantic action creates a new page, this stage may also emit:

- `create-page`

### 5.6 Validation

Purpose:

Run final validation before command bus dispatch.

Checks:

1. action schemas valid
2. referenced nodes valid
3. generated layout valid
4. plugin types registered
5. referenced themes exist when theme intent is compiled

## 6. Compiler Input and Output Contracts

```ts
export interface SemanticCompileContext {
  document: VisualDocument
  scene?: SceneGraph
  targetPageId?: PageId
  registry: PluginRegistry
  availableDatasets?: string[]
}

export type SemanticCompileResult =
  | SemanticCompileSuccess
  | SemanticCompileFailure

export interface SemanticCompileSuccess {
  ok: true
  executionPlan: SemanticExecutionPlan
  diagnostics?: CompilerDiagnostic[]
}

export interface SemanticCompileFailure {
  ok: false
  diagnostics: CompilerDiagnostic[]
}

export interface SemanticExecutionPlan {
  documentActions?: DocumentAction[]
  runtimeActions?: RuntimeAction[]
}

export interface CompilerDiagnostic {
  level: 'error' | 'warning'
  code: string
  message: string
}
```

Contract rules:

1. `ok: true` must always include an `executionPlan`.
2. `ok: false` must always include at least one diagnostic.
3. Compiler failure must not produce a partial execution plan.
4. `scene`, when provided, is the active in-memory `SceneGraph` for the target page rather than a persisted replay snapshot.
5. Session overlays such as `selection` and `viewport` must be ignored during compilation unless an explicit targeting rule chooses to consult them.
6. Persisted import or replay inputs should be materialized into an in-memory `SceneGraph` before compilation if scene-local planning is required.

## 7. AI Schema Requirements

Ordinary JSON schema is insufficient because AI also needs semantic guidance.

The engine must define AI-oriented component metadata.

```ts
export interface ComponentMeta {
  type: string
  title: string
  description: string
  category?: string
  props: PropMeta[]
  slots?: SlotMeta[]
  events?: EventMeta[]
  examples?: Example[]
  constraints?: Constraint[]
  ai?: {
    usage?: string[]
    antiPatterns?: string[]
    relatedComponents?: string[]
    keywords?: string[]
  }
}

export interface SlotMeta {
  key: string
  title: string
  allowedTypes?: string[]
  required?: boolean
}

export interface EventMeta {
  key: string
  title: string
  payloadType?: string
}

export interface Example {
  title: string
  props?: Record<string, unknown>
  description?: string
}

export interface PropMeta {
  key: string
  type: string
  required?: boolean
  defaultValue?: unknown
  enum?: unknown[]
  description?: string
  examples?: unknown[]
  ai?: {
    importance?: 'high' | 'low'
    semanticRole?: string
  }
}
```

AI metadata must help the model answer these questions:

1. what the component is for
2. when it should be used
3. what common mistakes to avoid
4. which props are critical
5. which surrounding components are compatible

## 8. Tool Calling Integration

Recommended chain:

```text
User Request
  -> LLM
  -> Tool Call
  -> Semantic Action
  -> Semantic Compiler
  -> Document Actions + Runtime Actions
  -> Document Command Bus + Runtime Command Bus
```

Rules:

1. Tool outputs must conform to semantic schemas.
2. Tool layer may ask follow-up questions for missing required fields.
3. Tool layer must not bypass compiler validation.
4. Tool layer must not bypass document-action validation when semantic intent creates or mutates pages.

## 9. Failure and Recovery

Compiler failures should return diagnostics rather than partial scene updates.

Failure examples:

1. no target container found
2. requested component type unavailable
3. layout planner cannot satisfy constraints
4. required semantic block missing

Recovery strategies:

1. ask AI for missing parameter
2. choose fallback template
3. degrade to simpler layout strategy
4. return actionable diagnostics to the editor UI
