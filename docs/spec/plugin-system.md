# Plugin System

## 1. Scope

This document defines how components and engine extensions are registered and consumed.

## 2. Goals

The plugin system must allow the engine to extend:

1. Renderable component types.
2. Component metadata for inspector and AI.
3. Constraints.
4. Semantic helpers and templates.
5. Optional runtime behaviors.

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

export interface Constraint {
  type: 'structural' | 'layout' | 'semantic' | 'theme'
  rule: string
}

export interface ComponentMeta {
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

export interface PropMeta {
  key: string
  type: 'string' | 'number' | 'boolean' | 'json'
  default?: unknown
  required?: boolean
  description?: string
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
  description?: string
}

export interface Example {
  title: string
  props: Record<string, unknown>
  description?: string
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
  context: NodeRenderContext
}

export interface NodeRenderContext {
  selected: boolean
  editable: boolean
  mode: 'editor' | 'runtime'
  engine: EngineAPI
  dataInteraction?: DataInteractionAPI
}
```

The canonical definition of `EngineAPI`, `DataInteractionAPI`, and `NodeRenderContext` is in `engine-api.md`.

Rules:

1. Renderers must not mutate scene state.
2. Renderers may emit callbacks that the editor translates into runtime actions.
3. Renderers should support fallback rendering when optional props are absent.

## 6. Component Metadata Requirements

Each plugin must define metadata sufficient for:

1. Insert panel.
2. Property inspector.
3. AI planning and usage hints.
4. Constraint validation.
5. Sample generation.

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

1. Register plugin at app startup.
2. Validate metadata shape.
3. Expose type to insert panel and AI schema index.
4. Use plugin defaults during `create-node`.
5. Use plugin renderer during rendering.
6. Use plugin constraints during validation.

## 8. Unknown Plugin Strategy

When a scene references an unregistered component type:

`MissingPluginPlaceholder` refers to the engine-provided fallback renderer used when a plugin type cannot be resolved.

1. Preserve node data.
2. Render `MissingPluginPlaceholder` in editor mode.
3. Render `MissingPluginPlaceholder` in runtime mode rather than silently hiding the node.
4. Surface structured warning during editing.
5. Upgrade the issue to a blocking error for publish and export flows.
6. Allow only conservative editor operations such as select, move, reparent, replace, or delete when metadata-driven editing is unavailable.
7. Block AI or compiler flows from creating new nodes of unknown plugin type.
8. Block AI operations that require missing plugin metadata unless an explicit fallback strategy is defined.

Mode-specific rules:

1. Editor mode may expose raw persisted fields such as `type`, `props`, and `layout` as read-only fallback inspection.
2. Runtime mode must stay honest about unsupported output and must not pretend the component rendered correctly.

## 9. Extensibility Boundaries

Plugins may extend:

1. Component rendering.
2. Component metadata.
3. Component defaults.
4. Validation rules.

Plugins may not:

1. Bypass runtime validation.
2. Mutate the scene outside runtime actions.
3. Inject non-serializable state into persisted node data.
