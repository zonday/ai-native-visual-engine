# Plugin System

## 1. Scope

This document defines how components and engine extensions are registered and consumed.

## 2. Goals

The plugin system must allow the engine to extend:

1. renderable component types
2. component metadata for inspector and AI
3. constraints
4. semantic helpers and templates
5. optional runtime behaviors

## 3. Component Plugin Contract

```ts
export interface ComponentPlugin {
  type: string
  renderer: Renderer
  meta: ComponentMeta
  constraints?: Constraint[]
  defaults?: ComponentDefaults
  capabilities?: ComponentCapabilities
}
```

Supporting contracts:

```ts
export interface ComponentDefaults {
  props?: Record<string, unknown>
  style?: Record<string, unknown>
  layout?: Partial<Layout>
}

export interface ComponentCapabilities {
  canHaveChildren?: boolean
  canResize?: boolean
  canRotate?: boolean
  allowedParentTypes?: string[]
  allowedChildTypes?: string[]
}
```

Rules:

1. `type` must be globally unique.
2. `renderer` must be pure with respect to scene data.
3. `meta` is required for editor UI and AI usage.
4. Plugin constraints augment global constraints.

## 4. Registry Contract

```ts
export interface PluginRegistry {
  registerComponent(plugin: ComponentPlugin): void
  getComponent(type: string): ComponentPlugin | undefined
  listComponents(): ComponentPlugin[]
}
```

Rules:

1. Duplicate registration fails fast.
2. Registry lookup is required before rendering or creating unknown node types.
3. Registry state must be initialized before scene load or AI compilation.

## 5. Renderer Contract

Renderer is responsible only for transforming scene nodes into view output.

```ts
export type Renderer = (input: RenderNodeInput) => unknown

export interface RenderNodeInput {
  node: SceneNode
  children: unknown[]
  context: RenderContext
}

export interface RenderContext {
  selected: boolean
  editable: boolean
  mode: 'editor' | 'runtime'
}
```

Rules:

1. Renderers must not mutate scene state.
2. Renderers may emit callbacks that the editor translates into runtime actions.
3. Renderers should support fallback rendering when optional props are absent.

## 6. Component Metadata Requirements

Each plugin must define metadata sufficient for:

1. insert panel
2. property inspector
3. AI planning and usage hints
4. constraint validation
5. sample generation

Minimum recommendation:

1. `type`
2. `title`
3. `description`
4. `category`
5. `props[]`
6. `ai.usage[]`
7. `ai.antiPatterns[]`

## 7. Plugin Lifecycle

Recommended lifecycle:

1. register plugin at app startup
2. validate metadata shape
3. expose type to insert panel and AI schema index
4. use plugin defaults during `create-node`
5. use plugin renderer during rendering
6. use plugin constraints during validation

## 8. Unknown Plugin Strategy

When a scene references an unregistered component type:

1. preserve node data
2. render fallback placeholder
3. surface structured warning
4. block AI operations that require the missing component unless fallback is defined

## 9. Extensibility Boundaries

Plugins may extend:

1. component rendering
2. component metadata
3. component defaults
4. validation rules

Plugins may not:

1. bypass runtime validation
2. mutate the scene outside runtime actions
3. inject non-serializable state into persisted node data
