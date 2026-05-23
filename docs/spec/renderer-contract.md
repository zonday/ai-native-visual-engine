# Renderer Contract

## 1. Scope

This document defines the renderer interface contract that any renderer implementation must satisfy. It covers supported rendering modes, node-type to visual-output mapping, fallback behavior, and the boundary between scene state and visual output.

## 2. Renderer Modes

The engine supports two rendering modes defined by `RenderContext`.

```ts
export interface RenderContext {
  mode: 'editor' | 'runtime'
  pageId: PageId
  scene: SceneGraph
  selection?: SelectionState
  viewport?: ViewportState
}
```

### 2.1 Editor Mode

1. Renders the active page scene.
2. May overlay selection chrome, resize handles, rotation grips, and grid guides.
3. Session state such as hover outlines, drag previews, and remote presence cursors may be rendered above the scene.
4. Editor mode is permitted to derive transient rendering data from the scene but must not mutate it.

### 2.2 Runtime Mode

1. Renders the active page scene as production output.
2. Must not render selection or editing chrome.
3. Must not render session overlays such as drag previews or remote cursors.
4. The output should be suitable for preview, embedding, or export.

## 3. Renderer Interface

Every renderer implementation must conform to this contract.

```ts
export type Renderer = (context: RenderContext) => RenderedOutput

export type RenderedOutput =
  | ReactElement
  | DOMNode
  | CanvasDrawList
```

Rules:

1. The renderer is pure with respect to scene state.
2. The renderer must never mutate `SceneGraph` or `PersistedSceneGraph`.
3. The return type is implementation-specific; a React renderer returns `ReactElement`, a canvas renderer returns a draw list.
4. The engine must not depend on a specific renderer implementation.

## 4. Node Type Rendering Contract

For each `SceneNode.type`, the renderer must resolve the corresponding plugin component.

```ts
export interface ResolvedRenderNode {
  nodeId: NodeId
  type: string
  output: RenderedOutput
  children: ResolvedRenderNode[]
}
```

### 4.1 Node Resolution Priority

1. Look up `SceneNode.type` in the `PluginRegistry`.
2. Use the plugin's registered renderer.
3. If the type is unregistered, render `MissingPluginPlaceholder`.

### 4.2 MissingPluginPlaceholder

When a scene references an unregistered component type, the renderer must produce a visible placeholder.

Requirements:

1. Render a bounded box with the missing type name.
2. Display a warning indicator, not a silent blank area.
3. In editor mode, offer a contextual action to replace or remove the node.
4. In runtime mode, render the placeholder without interactive controls.
5. The placeholder must not cause layout collapse or zero-size rendering.

```tsx
// Conceptual React example — implementation detail
function MissingPluginPlaceholder({ nodeType }: { nodeType: string }) {
  return (
    <div className="border-2 border-dashed border-amber-500 p-4 rounded">
      <span className="text-amber-600 text-sm">Unknown: {nodeType}</span>
    </div>
  )
}
```

## 5. Layout Rendering

The renderer must interpret `SceneNode.layout` and produce geometry.

### 5.1 Layout Mode Support

| Layout Mode | Minimum Support |
|------|------|
| `free` | Delegate to child renderer, no container constraints |
| `absolute` | Position at (`x`, `y`) with optional `width`/`height` |
| `flex` | Horizontal or vertical flex container with gap and alignment |
| `grid` | CSS-grid–like container with columns, row height, and gap |
| `grid-item` | Positioned at grid coordinates (`x`, `y`) with spans (`w`, `h`) |

### 5.2 Rendering Geometry Rules

1. Pixel geometry is derived from layout at render time.
2. Stored layout remains abstract; the renderer is the only consumer that converts to pixels.
3. The same layout must produce consistent visual output across renderer implementations.

## 6. Visibility And Locking

The renderer must honor `SceneNode.visible` and `SceneNode.locked`.

1. When `visible` is `false`, the node and its subtree must not be rendered.
2. When `locked` is `true`, the node must render normally but reject interactive mutations in editor mode.
3. Runtime mode ignores `locked` for rendering purposes.

## 7. Style And Theme Application

The renderer must apply styles and themes.

Order of precedence:

1. Inline `SceneNode.style` overrides.
2. Component plugin default style.
3. Active page theme (`Page.themeId`).
4. Document default theme (`VisualDocument.activeThemeId`).

Rules:

1. Theme tokens are resolved at render time.
2. The renderer must not persist resolved style back into the scene graph.
3. If a referenced theme does not exist, the renderer falls back to an engine-provided base theme.

## 8. Renderer Performance Boundaries

Minimum performance expectations for the renderer:

1. Must not cause layout thrashing from redundant scene reads.
2. Must support batched updates during action replay.
3. Must isolate rendering per page; switching pages must not leak render state.

## 9. Relationship To Other Specs

- `domain-model.md`: `SceneGraph`, `SceneNode`, `Layout`, `Theme`
- `runtime-engine.md`: `RuntimeAction`, scene mutation contract
- `plugin-system.md`: `ComponentPlugin`, `Renderer`, `PluginRegistry`, `MissingPluginPlaceholder`
- `editor-interaction.md`: editor mode overlays and transform handles
