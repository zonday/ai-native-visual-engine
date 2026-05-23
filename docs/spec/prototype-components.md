# Prototype Components

## 1. Scope

This document defines the prototype component system: user-definable reusable presets that live above the plugin layer. A prototype is a saved set of default props, styles, and layout for a given plugin type.

## 2. Concept

```
ComponentPlugin      → code-defined: type, renderer, props schema
PrototypeComponent   → user-defined: named preset for a plugin type
SceneNode            → instance: inherits from a prototype, may locally override
```

A prototype is not a component type. It is a user-owned blueprint that pre-fills props, style, and layout. Instances inherit from their prototype and apply local overrides.

## 3. Prototype Model

Prototypes are owned by the document, like themes and variables.

```ts
interface VisualDocument {
  // ... existing fields
  prototypes?: PrototypeComponent[]
}

interface PrototypeComponent {
  id: string
  name: string
  description?: string
  baseType: string
  defaultProps: Record<string, unknown>
  defaultStyle: Record<string, unknown>
  defaultLayout?: Partial<Layout>
}
```

Rules:

1. `baseType` must reference a registered `ComponentPlugin.type`.
2. `defaultProps` must pass Zod validation against the plugin's props schema.
3. `name` must be unique within the document's prototypes.
4. Prototypes are persisted in `DocumentSnapshot`.

## 4. Instance Model

A scene node becomes an instance by referencing a prototype.

```ts
interface SceneNode {
  prototypeId?: string
  props: Record<string, unknown>
  style: Record<string, unknown>
  layout?: Layout
}
```

### 4.1 Resolution

At render time, the effective props, style, and layout are resolved by merging prototype defaults with instance overrides.

```ts
export function resolveInstance(
  node: SceneNode,
  prototype: PrototypeComponent | undefined
): ResolvedInstance {
  if (!node.prototypeId || !prototype) {
    return {
      props: node.props,
      style: node.style,
      layout: node.layout,
    }
  }

  return {
    props: { ...prototype.defaultProps, ...node.props },
    style: { ...prototype.defaultStyle, ...node.style },
    layout: node.layout ?? prototype.defaultLayout,
  }
}

interface ResolvedInstance {
  props: Record<string, unknown>
  style: Record<string, unknown>
  layout?: Layout
}
```

Rules:

1. Instance `props` shallow-merge prototype `defaultProps` with node `props`. Instance values win.
2. Instance `style` shallow-merge prototype `defaultStyle` with node `style`. Instance values win.
3. Instance `layout` uses node `layout` if present, otherwise falls back to prototype `defaultLayout`.
4. Resolution is compute-only — the resolved values are never persisted back into the scene graph.
5. The renderer receives the resolved instance, not the raw node.

### 4.2 Creation

Creating a node from a prototype:

```ts
export function createNodeFromPrototype(
  prototype: PrototypeComponent,
  parentId: NodeId,
  overrides?: Partial<SceneNode>
): SceneNode {
  return {
    id: generateId(),
    type: prototype.baseType,
    prototypeId: prototype.id,
    parentId,
    props: { ...overrides?.props ?? {} },
    style: { ...overrides?.style ?? {} },
    layout: overrides?.layout ?? prototype.defaultLayout,
  }
}
```

The created node starts with empty `props` and `style` — all values are inherited from the prototype at render time. Overrides passed at creation time become the instance's local values.

## 5. Prototype Lifecycle

### 5.1 Create

A user creates a prototype from an existing node.

```text
User selects a node → "Save as prototype" → provide name → prototype created
```

```ts
export function createPrototypeFromNode(
  node: SceneNode,
  name: string,
  document: VisualDocument
): PrototypeComponent
```

### 5.2 Update

Updating a prototype propagates to all its instances at the next render.

```ts
export function updatePrototype(
  prototypeId: string,
  updates: Partial<PrototypeComponent>,
  document: VisualDocument
): VisualDocument
```

No action dispatch is needed for instances — they re-resolve on next render because they inherit from the updated prototype.

### 5.3 Detach

An instance may be detached from its prototype, becoming an independent node.

```ts
export function detachInstance(node: SceneNode): SceneNode
```

Detaching resolves the current effective state into the node's own `props` and `style`, then clears `prototypeId`.

```ts
function detachInstance(node: SceneNode, prototype: PrototypeComponent): SceneNode {
  const resolved = resolveInstance(node, prototype)
  return {
    ...node,
    prototypeId: undefined,
    props: resolved.props,
    style: resolved.style,
    layout: resolved.layout,
  }
}
```

### 5.4 Delete

Deleting a prototype does not cascade-delete its instances. All instances are detached automatically at delete time.

## 6. Override Semantics

### 6.1 Local Override

When an instance sets a prop locally, that prop diverges from the prototype. Future prototype updates do not affect that prop on this instance.

```text
Prototype: defaultProps = { label: 'Revenue', format: 'currency' }

Instance A: props = { label: 'Sales' }
  → resolved: { label: 'Sales', format: 'currency' }   // label overridden

Instance B: props = {}
  → resolved: { label: 'Revenue', format: 'currency' }  // fully inherited

Update prototype: label → 'Income'
  Instance A: label stays 'Sales'   // protected by local override
  Instance B: label becomes 'Income' // inherits update
```

### 6.2 Reset Override

An instance may reset a local override to re-inherit the prototype value.

```ts
// Set label back to prototype default
api.dispatch.updateProps(nodeId, { label: undefined })
```

Setting a prop to `undefined` removes the local override. The next resolve inherits from the prototype.

## 7. Editor Integration

### 7.1 Prototype Panel

A panel in the editor lists all document prototypes. Users may:

1. Drag a prototype onto the canvas to create an instance.
2. Edit a prototype's defaults in the inspector.
3. Delete a prototype (instances are detach-automatically).

### 7.2 Instance Inspector

When an instance is selected, the inspector shows:

1. The prototype name and a link to edit it.
2. Locally overridden props highlighted.
3. Inherited props shown with a dimmed style and the prototype value.
4. A "Detach" button to convert the instance to an independent node.

### 7.3 Override Indicator

Instances on the canvas display a subtle prototype badge. Props that diverge from the prototype are marked in the inspector.

## 8. Testing Contract

Key test scenarios:

1. Creating an instance from a prototype produces the correct resolved props.
2. Updating a prototype propagates to instances without local overrides.
3. A locally overridden prop is not overwritten by a prototype update.
4. Detaching an instance preserves its current effective state.
5. Deleting a prototype detaches all instances.
6. Reset-override re-inherits the prototype value.
7. Resolved values are never persisted — only raw instance data is in `DocumentSnapshot`.

## 9. Relationship To Other Specs

- `domain-model.md`: `SceneNode`, `VisualDocument`, `Layout`
- `component-types.md`: `ComponentPlugin`, base types for `baseType`
- `plugin-system.md`: `PluginRegistry`, `ComponentPlugin`
- `schema-validation.md`: Zod validation for `defaultProps`
- `renderer-contract.md`: resolved instance rendering
