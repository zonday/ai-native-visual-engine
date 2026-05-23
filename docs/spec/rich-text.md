# Rich Text

## 1. Scope

This document defines the rich text model for the `text` component: the content format, the editor surface, serialization, and interaction with the scene graph.

## 2. Content Model

The `text` component's `content` prop is a Tiptap JSON document, not a plain string.

```ts
// SceneNode.props for type 'text'
interface TextProps {
  content: DocNode          // Tiptap JSON document
  placeholder?: string
  editable?: boolean
}

// Tiptap document root
interface DocNode {
  type: 'doc'
  content: BlockNode[]
}

type BlockNode =
  | { type: 'paragraph'; content?: InlineNode[] }
  | { type: 'heading'; attrs: { level: 1 | 2 | 3 }; content?: InlineNode[] }
  | { type: 'bulletList'; content?: ListItemNode[] }
  | { type: 'orderedList'; content?: ListItemNode[] }
  | { type: 'blockquote'; content?: BlockNode[] }
  | { type: 'codeBlock'; content?: TextNode[] }

interface ListItemNode {
  type: 'listItem'
  content: (BlockNode | InlineNode)[]
}

type InlineNode =
  | { type: 'text'; text: string; marks?: MarkNode[] }
  | { type: 'hardBreak' }

type MarkNode =
  | { type: 'bold' }
  | { type: 'italic' }
  | { type: 'underline' }
  | { type: 'strike' }
  | { type: 'code' }
  | { type: 'link'; attrs: { href: string; title?: string } }
```

### 2.1 Empty Document

```ts
const EMPTY_DOC: DocNode = {
  type: 'doc',
  content: [{ type: 'paragraph' }],
}
```

### 2.2 Plain Text Extraction

```ts
export function extractPlainText(doc: DocNode): string
```

Returns the concatenated text content of all text nodes, for search and indexing.

### 2.3 Plain Text Import

```ts
export function plainTextToDoc(text: string): DocNode
```

Converts a plain string to a single-paragraph document.

```ts
plainTextToDoc('Hello world')
// -> { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello world' }] }] }
```

## 3. Editor Surface

The rich text editor uses Tiptap embedded in the editor canvas at the text node's position.

### 3.1 Integration

```tsx
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'

function RichTextEditor({ node, api }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [StarterKit, Underline, Link],
    content: node.props.content,
    editable: node.props.editable !== false,
    onUpdate: ({ editor }) => {
      const json = editor.getJSON() as DocNode
      api.dispatch.updateProps(node.id, { content: json })
    },
  })

  return <EditorContent editor={editor} />
}
```

### 3.2 Mode Behavior

| Mode | Behavior |
|------|------|
| `editor` | Fully editable if `editable` is not `false`. Shows formatting toolbar on focus. |
| `runtime` | Rendered as static rich text. No editing controls. |

### 3.3 Toolbar

When a text node is selected in editor mode, a formatting toolbar appears:

- Bold, Italic, Underline, Strikethrough
- Heading levels (H1, H2, H3)
- Bullet list, Ordered list
- Blockquote, Code block
- Link (with URL input)

The toolbar is an editor shell concern, not a text node concern. The text node itself only stores content.

## 4. Serialization

### 4.1 Persistence

The Tiptap JSON document is stored directly in `SceneNode.props.content`. It is:

1. Serializable — JSON, no functions or DOM references.
2. Deterministic — the same document structure produces the same JSON.
3. Validatable — the engine validates the JSON structure on commit.

### 4.2 Validation

```ts
export function validateRichText(doc: unknown): doc is DocNode
```

Rules:

1. Root must be `{ type: 'doc' }`.
2. Every `type` field must be a recognized node type.
3. `content` arrays must contain valid child types for the parent.
4. `attrs` objects must match the expected shape for the node type.
5. `marks` arrays must contain recognized mark types.

Invalid rich text `content` is rejected at commit time, not fixed silently.

### 4.3 Inverse Action

The inverse of `update-props` changing `content` from `D1` to `D2` is `update-props` setting `content` back to `D1`.

## 5. Theme Integration

Rich text inherits typography tokens from the active theme.

```text
DocNode
  -> paragraph -> body font size, line height
  -> heading(1) -> headingScale × fontSizeRoot
  -> heading(2) -> headingScale² × fontSizeRoot
  -> codeBlock -> fontFamilyMono
  -> link -> accent color
```

The resolved typography is applied during rendering. The theme is not embedded in the content JSON.

## 6. Binding

A `text` node may have its `content` driven by a data binding instead of static content.

```ts
// Binding that populates text content from a variable
const binding: Binding = {
  key: 'text.content',
  source: 'variable:welcome-message',
}
```

When bound, the text is read-only. The binding value overrides `props.content`.

## 7. Markdown Interop

For import/export convenience, the engine supports Markdown as a transport format, but not as a storage format.

```ts
export function markdownToDoc(md: string): DocNode
export function docToMarkdown(doc: DocNode): string
```

Rules:

1. Markdown is only used at import/export boundaries.
2. Stored content is always Tiptap JSON.
3. The Markdown round-trip is lossy — comments and non-standard syntax are dropped.
4. An AI-generated `text` node may specify content as Markdown; the compiler converts to JSON before creating the node.

## 8. Testing Contract

See `testing-and-fixtures.md`. Key rich text test scenarios:

1. A `text` node with valid Tiptap JSON content renders correctly.
2. Editing content dispatches `update-props` with the new JSON.
3. Undo restores the previous content JSON.
4. Invalid JSON content is rejected at commit.
5. Plain text extraction works for search.
6. Markdown import/export is lossy but preserves structure.
7. Bound text nodes are read-only in editor mode.

## 9. Relationship To Other Specs

- `component-types.md`: `text` component definition
- `domain-model.md`: `SceneNode.props`, `SceneNode.bindings`
- `runtime-engine.md`: `update-props`, `update-bindings`
- `theme-and-tokens.md`: typography token resolution
- `data-binding.md`: `Binding` for text content
- `engine-api.md`: `dispatch.updateProps`
