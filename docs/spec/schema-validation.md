# Schema Validation

## 1. Scope

This document defines which types require Zod schemas, which do not, and how schema validation integrates with the engine and plugin system.

## 2. Principle

Zod schemas are required at every **trust boundary** — any point where data enters the engine from an external source. Inside the engine, types inferred from Zod schemas are the canonical TypeScript type. Manually maintained interfaces are not the source of truth.

## 3. Trust Boundaries

| Boundary | Requires Zod Schema | Reason |
|------|------|------|
| `DocumentSnapshot` import | Yes | External file or API payload |
| `RuntimeAction` payload | Yes | AI compiler output, editor UI, collaboration sync |
| `DocumentAction` payload | Yes | Same as above |
| `SceneNode.props` update | Yes | Editor UI or plugin renderer writes props |
| `SemanticAction` payload | Yes | AI model output |
| Plugin `ComponentPlugin` registration | Yes | Plugin manifest loaded at startup |
| `ComponentDefaults.props` | Yes | Plugin-defined defaults merged into node props |
| Plugin `Constraint` rules | No | Engine-evaluated strings, not user data |
| Internal engine state (`nodes` map, `children` arrays) | No | Already validated at entry; internal consistency enforced by invariants |
| `HistoryEntry` | No | Built by middleware from already-validated actions |
| `SelectionState`, `ViewportState` | No | Session-scoped, editor-owned |
| `Theme`, `Variable`, `Asset` | Yes | Edited by user through UI |

## 4. Zod Schema Requirements

### 4.1 Core Types

Every core type defined in `domain-model.md` that crosses a trust boundary must have a Zod schema.

```ts
// packages/core/src/document/schemas.ts
import { z } from 'zod/v4'

export const PageSchema = z.object({
  id: z.string(),
  name: z.string(),
  sceneId: z.string(),
  route: z.string().optional(),
  themeId: z.string().optional(),
})

export const CreatePageActionSchema = z.object({
  type: z.literal('create-page'),
  page: PageSchema,
  scene: z.object({
    rootId: z.string(),
    nodes: z.record(z.string(), z.any()),
    version: z.number(),
  }),
})

// Type inference — canonical TypeScript type
export type CreatePageAction = z.infer<typeof CreatePageActionSchema>
```

Rules:

1. Every schema lives alongside its type, not in a separate file.
2. The inferred type is the canonical TypeScript type.
3. Hand-written interfaces are removed once the schema exists.

### 4.2 Plugin Props

Every plugin must define a Zod schema for its props. The schema is used by the validator middleware when processing `update-props`.

```ts
// Default plugin: metric-value
import { z } from 'zod/v4'

export const MetricValuePropsSchema = z.object({
  label: z.string().default('Metric'),
  value: z.union([z.number(), z.string()]).default(0),
  format: z.enum(['number', 'currency', 'percent']).default('number'),
  prefix: z.string().optional(),
  suffix: z.string().optional(),
  color: z.string().optional(),
})

export type MetricValueProps = z.infer<typeof MetricValuePropsSchema>
```

### 4.3 Plugin Registration

The `ComponentPlugin` manifest is validated on registration against a schema derived from `plugin-system.md`'s type definitions. The schema validates `type` uniqueness, `renderer` presence, required `meta` fields, and optional constraint/capability shapes.

### 4.4 Rich Text Content

The `text` component's `content` field is validated as a Tiptap JSON document.

```ts
export const DocNodeSchema: z.ZodType<DocNode> = z.object({
  type: z.literal('doc'),
  content: z.array(z.object({
    type: z.string(),
    content: z.array(z.any()).optional(),
    attrs: z.record(z.string(), z.unknown()).optional(),
    text: z.string().optional(),
  })),
})
```

## 5. Validator Middleware

Validation runs in the middleware pipeline before the handler.

```text
Action dispatch
  -> Logger
  -> Validator (Zod schema validation — this section)
  -> Undo/History
  -> Collaboration
  -> Handler
```

The validator runs at the command-bus dispatch level, before routing to a specific handler.

```ts
export function createValidatorMiddleware(schemas: SchemaRegistry) {
  return (action: RuntimeAction, dispatch: (action: RuntimeAction) => DispatchResult) => {
    const schema = schemas.getActionSchema(action.type)
    if (!schema) {
      return { ok: false, scene: currentScene, error: { code: 'validation.unknown-action-type' } }
    }

    const result = schema.safeParse(action)
    if (!result.success) {
      return { ok: false, scene: currentScene, error: { code: 'validation.action-schema-mismatch', message: result.error.message } }
    }

    return dispatch(action)
  }
}
```

Rules:

1. The validator middleware runs for every action dispatch at the command-bus level.
2. If the Zod schema for the action type is not registered, the action is rejected.
3. If `safeParse` fails, the action is rejected with the Zod error message.
4. Component `props` are validated against the plugin's props schema during `update-props`.
5. `create-node` validates the full `node.props` against the plugin schema.
6. Validation failures return the pre-dispatch scene state — no partial mutations occur.

## 6. Schema Registry

The engine maintains a registry of Zod schemas keyed by action type and plugin type.

```ts
export interface SchemaRegistry {
  registerActionSchema(type: string, schema: z.ZodType): void
  registerPluginPropsSchema(type: string, schema: z.ZodType): void
  getActionSchema(type: string): z.ZodType | undefined
  getPluginPropsSchema(type: string): z.ZodType | undefined
}
```

Rules:

1. Action schemas are registered at engine initialization.
2. Plugin props schemas are registered when the plugin is registered.
3. If a plugin does not provide a props schema, `update-props` on that node type is rejected.
4. Default plugins ship with their schemas.

## 7. Validation Error Reporting

Zod errors are surfaced through the structured error system.

```ts
export interface ZodValidationError extends EngineError {
  code: 'validation.action-schema-mismatch'
  domain: 'validation'
  severity: 'error'
  recoverable: true
  zodIssues: z.ZodIssue[]
}
```

Rules:

1. Zod issues are mapped to human-readable messages.
2. The full `zodIssues` array is available for debugging.
3. Validation errors are surfaced inline on the affected node in the editor.

## 8. Schema As Source Of Truth

Types inferred from Zod schemas replace hand-written interfaces.

```ts
// BEFORE — manual interface
export interface CreatePageAction {
  type: 'create-page'
  page: Page
  scene: PersistedSceneGraph
}

// AFTER — inferred from Zod schema
export const CreatePageActionSchema = z.object({
  type: z.literal('create-page'),
  page: PageSchema,
  scene: PersistedSceneGraphSchema,
})
export type CreatePageAction = z.infer<typeof CreatePageActionSchema>
```

Rules:

1. The Zod schema is the single source of truth.
2. The inferred type is exported for consumers.
3. Manual interfaces that duplicate the schema shape are removed.
4. This applies to all core types, action types, plugin types, and API boundary types.

## 9. Plugin Schema Contract

Every plugin must export its props schema along with its `ComponentPlugin` definition.

```ts
// packages/editor/plugins/metric-value/index.ts
export const metricValuePropsSchema = MetricValuePropsSchema

export const metricValuePlugin: ComponentPlugin = {
  type: 'metric-value',
  renderer: MetricValueRenderer,
  meta: {
    title: 'Metric Value',
    description: 'Single metric display.',
    category: 'display',
    props: Object.keys(MetricValuePropsSchema.shape).map(key => ({
      key,
      type: inferPropType(MetricValuePropsSchema.shape[key]),
      default: MetricValuePropsSchema.shape[key]._def.defaultValue?.(),
    })),
    ai: { usage: ['KPI display'], antiPatterns: [] },
  },
  defaults: {
    props: MetricValuePropsSchema.parse({}),
  },
}
```

## 10. Relationship To Other Specs

- `constraints-and-validation.md`: validation layers and constraint system
- `error-handling.md`: structured error codes for validation failures
- `plugin-system.md`: `ComponentPlugin` registration contract
- `component-types.md`: default plugin props definitions
- `domain-model.md`: core types that require Zod schemas
- `implementation-stack.md`: Zod dependency version
