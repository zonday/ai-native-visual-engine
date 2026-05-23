# Domain Model

## 1. Scope

This document defines the authoritative data model for documents, pages, scenes, nodes, layout, and editor-owned state.

The goal is to ensure every subsystem uses the same vocabulary and state boundaries.

## 2. Core Types

```ts
export type DocumentId = string
export type PageId = string
export type SceneId = string
export type NodeId = string
```

IDs should be opaque strings. The engine must not encode runtime meaning into IDs.

## 3. Document Model

`VisualDocument` is the top-level editing artifact.

```ts
export interface VisualDocument {
  id: DocumentId
  title: string
  pages: Page[]
  scenes: Record<SceneId, PersistedSceneGraph>
  themes?: Theme[]
  assets?: Asset[]
  variables?: Variable[]
  metadata?: DocumentMetadata
}
```

Rules:

1. A document owns page definitions, themes, reusable assets, and global variables.
2. A document owns all persisted page scenes through `scenes`.
3. Multi-tab dashboards are modeled as multiple `Page` records or as container components within a single page, depending on product requirements. The default engine-level model is multiple pages.
4. Every `Page.sceneId` must resolve to an existing key in `scenes`.

Supporting definitions:

```ts
export interface Page {
  id: PageId
  name: string
  sceneId: SceneId
  route?: string
  metadata?: PageMetadata
}

export interface Theme {
  id: string
  name: string
  mode?: 'light' | 'dark'
  tokens?: Record<string, unknown>
}

export interface Asset {
  id: string
  type: string
  name: string
  url?: string
  metadata?: Record<string, unknown>
}

export interface Variable {
  id: string
  name: string
  type: string
  value?: unknown
}

export interface PageMetadata {
  icon?: string
  hidden?: boolean
  createdAt?: number
  updatedAt?: number
}

export interface DocumentMetadata {
  createdAt?: number
  updatedAt?: number
  ownerId?: string
  version?: number
}
```

## 4. Scene Graph Model

Each page references one persisted scene. The editor may materialize that persisted scene into an in-memory `SceneGraph` with session overlays.

```ts
export interface PersistedSceneGraph {
  version: number
  rootId: NodeId
  nodes: Record<NodeId, SceneNode>
  metadata?: SceneMetadata
}

export interface SceneGraph extends PersistedSceneGraph {
  selection?: SelectionState
  viewport?: ViewportState
}

export interface SelectionState {
  nodeIds: NodeId[]
}

export interface ViewportState {
  zoom: number
  x: number
  y: number
}

export interface SceneMetadata {
  title?: string
  createdAt?: number
  updatedAt?: number
}
```

Rules:

1. `nodes` is the normalized storage layer.
2. `rootId` identifies the single root node.
3. `PersistedSceneGraph` is the durable scene model used for persistence, import/export, and replay.
4. `SceneGraph` is the in-memory editor model for an active page and may include session overlays such as `selection` and `viewport`.
5. `selection` and `viewport` are session-scoped by default and are not serialized into `VisualDocument.scenes`.
6. `version` increments whenever a committed content mutation changes persisted scene content.

## 5. Persistence Root

The persistence root for import, export, and storage is the full document snapshot.

```ts
export interface DocumentSnapshot {
  document: VisualDocument
}
```

Rules:

1. `DocumentSnapshot.document.scenes` stores persisted scene content only.
2. Session overlays such as local selection, viewport position, hover state, and remote presence are stored outside the persisted snapshot.
3. Import/export pipelines operate on `DocumentSnapshot`, not ad hoc combinations of pages and detached scene files.

## 6. Scene Node Model

```ts
export interface SceneNode {
  id: NodeId
  type: string
  name?: string
  parentId?: NodeId
  children?: NodeId[]
  props?: Record<string, unknown>
  style?: Style
  layout?: Layout
  bindings?: Binding[]
  runtime?: RuntimeState
  visible?: boolean
  locked?: boolean
  metadata?: NodeMetadata
}
```

Field semantics:

1. `type`
   Component type registered through the plugin system.

2. `children`
   Ordered child node IDs. Omitted or empty means leaf node.

3. `props`
   Serializable component inputs.

4. `style`
   Visual style tokens or resolved values. This must remain serializable.

5. `layout`
   Container or item layout description.

6. `bindings`
   Data bindings, variable references, or event source mappings.

7. `runtime`
   Renderer-agnostic runtime state that is still part of persisted scene behavior, such as chart dataset binding mode. This field must remain serializable.

8. `visible`
   Semantic visibility flag. Hidden nodes remain in the scene graph.

9. `locked`
   Editing lock flag. Locked nodes render normally but reject editor mutations unless privileged actions override them.

## 7. Node Tree Constraints

The following constraints are mandatory:

1. Root node must not have `parentId`.
2. Every child ID must resolve to an existing node.
3. Every child node must reference the same parent via `parentId`.
4. Cycles are forbidden.
5. Deleting a node deletes its subtree unless an action explicitly defines reparenting behavior.

## 8. Layout Model

Layout is split into container layouts and item layouts.

```ts
export type Layout =
  | FreeLayout
  | AbsoluteLayout
  | FlexLayout
  | GridLayout
  | GridItemLayout

export interface LayoutBase {
  mode: 'free' | 'absolute' | 'flex' | 'grid' | 'grid-item'
}
```

### 8.1 Free Layout

```ts
export interface FreeLayout extends LayoutBase {
  mode: 'free'
}
```

Use when a container delegates placement to custom logic or when layout is intentionally unconstrained.

### 8.2 Absolute Layout

```ts
export interface AbsoluteLayout extends LayoutBase {
  mode: 'absolute'
  x?: number
  y?: number
  width?: number
  height?: number
  rotation?: number
  zIndex?: number
}
```

Use for overlay, canvas-style placement, or transform-based editing.

### 8.3 Flex Layout

```ts
export interface FlexLayout extends LayoutBase {
  mode: 'flex'
  direction: 'horizontal' | 'vertical'
  gap?: number
  align?: 'start' | 'center' | 'end' | 'stretch'
  justify?: 'start' | 'center' | 'end' | 'space-between'
  wrap?: boolean
}
```

### 8.4 Grid Layout

```ts
export interface GridLayout extends LayoutBase {
  mode: 'grid'
  columns: number
  rowHeight: number
  gap: number
  autoFlow?: 'row' | 'column'
}
```

### 8.5 Grid Item Layout

```ts
export interface GridItemLayout extends LayoutBase {
  mode: 'grid-item'
  x: number
  y: number
  w: number
  h: number
  minW?: number
  minH?: number
  maxW?: number
  maxH?: number
}
```

Rules:

1. A node using `grid-item` must be a child of a `grid` container.
2. Grid coordinates are logical grid units, not pixels.
3. Layout engines may derive pixel geometry at runtime, but stored layout remains abstract.

## 9. Style, Binding, Runtime Metadata

The concrete subtypes may evolve, but the following rules apply:

```ts
export interface Style {
  [key: string]: unknown
}

export interface Binding {
  key: string
  source: string
  path?: string
  transform?: string
}

export interface RuntimeState {
  [key: string]: unknown
}

export interface NodeMetadata {
  label?: string
  description?: string
  createdAt?: number
  updatedAt?: number
}
```

Rules:

1. All persisted fields must remain serializable.
2. Renderer-only caches must not be persisted in `SceneNode`.
3. Transient drag handles, hover outlines, and portal state belong outside persisted scene data.

## 10. Editor State Ownership

State ownership is defined as follows:

1. `SceneGraph`
   Stores the active page scene in memory, including session overlays required by the editor.

2. `Document`
   Stores cross-page resources, page definitions, and persisted scenes.

3. `EditorSessionState`
   Stores non-persistent session UI state such as open panels, hovered node, active tool, or clipboard preview.

Example:

```ts
export interface EditorSessionState {
  activePageId?: PageId
  hoveredNodeId?: NodeId
  localClipboard?: NodeId[]
  activeTool?: 'select' | 'move' | 'resize' | 'text' | 'pan'
  rightPanelTab?: string
}
```

This state may use Zustand or another UI store, but it is not the page model.

## 11. Serialization Rules

1. `DocumentSnapshot` and `PersistedSceneGraph` must be pure JSON data.
2. Session overlays such as `selection`, `viewport`, hover state, and presence state are excluded from persisted document serialization by default.
3. Functions, class instances, DOM references, renderer handles, and mutable external references are forbidden in persisted state.
4. Unknown node types may be preserved during load, but must render as fallback placeholders rather than crashing the scene.
