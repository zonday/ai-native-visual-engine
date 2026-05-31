# Component States

## 1. Scope

This document defines the component state model: how a component defines named states, how each state maps to props overrides, and how linked components (e.g. tabs) coordinate mutual state exclusivity.

## 2. State Model

A component state is a named condition with associated prop overrides.

```ts
interface ComponentStateDef {
  name: string
  props: Record<string, unknown>
  exclusiveGroup?: string
}

interface ComponentStatesConfig {
  states: ComponentStateDef[]
}
```

### 2.1 Example: Tab

```ts
const tabStates: ComponentStatesConfig = {
  states: [
    {
      name: 'selected',
      props: { color: 'blue', weight: 'bold', indicator: 'visible' },
    },
    {
      name: 'default',
      props: { color: 'gray', weight: 'normal', indicator: 'hidden' },
    },
    {
      name: 'hovered',
      props: { color: 'lightblue', weight: 'normal', indicator: 'hidden' },
    },
    {
      name: 'disabled',
      props: { color: 'lightgray', weight: 'normal', interactive: false },
    },
  ],
}
```

### 2.2 Example: Button

```ts
const buttonStates: ComponentStatesConfig = {
  states: [
    {
      name: 'default',
      props: { background: '#3366ff', color: '#ffffff' },
    },
    {
      name: 'hovered',
      props: { background: '#4477ff', color: '#ffffff' },
    },
    {
      name: 'pressed',
      props: { background: '#2255ee', color: '#ffffff' },
    },
    {
      name: 'disabled',
      props: { background: '#cccccc', color: '#888888', interactive: false },
    },
  ],
}
```

## 3. States On SceneNode

Each node tracks its active states at runtime.

```ts
interface SceneNode {
  activeStates?: string[]
}
```

Rules:

1. `activeStates` is a set of currently active state names.
2. Multiple states may be active simultaneously (e.g. `['selected', 'hovered']`).
3. The order of activation is preserved; later states override earlier ones on conflict.
4. `activeStates` is session-scoped and not persisted to `DocumentSnapshot` by default.
5. If a component wants certain states persisted (e.g. `selected` on a tab), it explicitly opts in via the states config.

### 3.1 Persisted States

States that should survive reload are marked.

```ts
interface ComponentStateDef {
  name: string
  props: Record<string, unknown>
  persisted?: boolean
}
```

When `persisted: true`, the state is written to `SceneNode.runtime`, not `activeStates`.

## 4. State Resolution

At render time, active states are merged in activation order.

```ts
export function resolveStateProps(
  node: SceneNode,
  config: ComponentStatesConfig
): Record<string, unknown> {
  const active = node.activeStates ?? []
  let resolved: Record<string, unknown> = {}

  for (const stateName of active) {
    const stateDef = config.states.find(s => s.name === stateName)
    if (stateDef) {
      resolved = { ...resolved, ...stateDef.props }
    }
  }

  return resolved
}
```

Resolution order example:

```text
default active → { color: 'gray', weight: 'normal' }
hovered enters → { color: 'lightblue', weight: 'normal' }   // color overridden
selected enters→ { color: 'blue', weight: 'bold' }            // color + weight overridden
```

Final props passed to renderer: `{ color: 'blue', weight: 'bold' }`

The resolved props are shallow-merged with `node.props` and prototype overrides — state props are the innermost layer.

## 5. State Transitions

States are activated and deactivated through a state API.

```ts
export interface StateAPI {
  setState(nodeId: NodeId, state: string): void
  clearState(nodeId: NodeId, state: string): void
  setExclusive(nodeId: NodeId, state: string, group: string): void
  getActiveStates(nodeId: NodeId): string[]
}
```

### 5.1 setState

Activates a state on a node. If the state is already active, it is moved to the end of the activation order.

### 5.2 clearState

Deactivates a state. If the state was the only active state and no `default` state exists, props revert to the base `node.props`.

### 5.3 setExclusive

Activates a state and deactivates all other states in the same exclusive group across linked nodes. Used for tab groups, radio groups, and accordion panels.

```ts
// Selecting tab-2:
api.setExclusive('tab-2', 'selected', 'tab-group-main')

// This activates 'selected' on tab-2 and clears 'selected' on all other tabs
// in the same exclusive group.
```

## 6. Exclusive Groups

An exclusive group ensures that only one node in the group has a given state active.

```ts
interface ExclusiveGroup {
  id: string
  stateName: string
  nodeIds: NodeId[]
}
```

When a node in the group activates the state, all other nodes in the group have that state cleared.

```text
Tab group "main":
  tab-1: selected ← was active, cleared
  tab-2: selected ← newly activated
  tab-3: selected ← was active, cleared
```

Exclusive groups are session-scoped and determined by the editor UI context, not by the scene graph.

## 7. Interactive States

Standard interactive states that every interactive component may support:

| State | Trigger | Scope |
|------|------|------|
| `default` | Component renders with no interaction | Persistent |
| `hovered` | Pointer enters the node | Session |
| `pressed` | Pointer down on the node | Session |
| `focused` | Node receives keyboard focus | Session |
| `selected` | Node is part of the current selection | Session |
| `disabled` | Node is locked or a parent disallows interaction | Derived from `locked` |
| `active` | Node is the current editing target | Session |
| `dragging` | Node is being dragged | Session |

Interactive states are handled by the editor shell, not by individual component renderers. The component receives them as `NodeRenderContext` fields or resolved props.

## 8. Renderer Integration

The renderer receives resolved state props through `NodeRenderContext`.

```ts
export interface NodeRenderContext {
  selected: boolean
  editable: boolean
  mode: 'editor' | 'runtime'
  engine: EngineFacade
  dataInteraction?: DataInteractionAPI
  stateProps: Record<string, unknown>
}
```

Rules:

1. `stateProps` is computed before the render pass from `activeStates` + the component's states config.
2. State props are shallow-merged into `node.props` before passing to the renderer.
3. The renderer must not write back state props — they are engine-managed.
4. Interactive states (`hovered`, `pressed`, `focused`) are set by the editor shell's event system.
5. Persistent states (`selected` for tabs) are set by component logic via `engine.states`.

## 9. Plugin Registration

Components declare their supported states in plugin metadata.

```ts
const tabPlugin: ComponentPlugin = {
  type: 'tab',
  meta: {
    title: 'Tab',
    // ...
    states: [
      { name: 'default', props: { color: 'gray', weight: 'normal' } },
      {
        name: 'selected',
        props: { color: 'blue', weight: 'bold' },
        persisted: true,
      },
      { name: 'hovered', props: { color: 'lightblue' } },
      { name: 'disabled', props: { color: 'lightgray', interactive: false } },
    ],
  },
}
```

## 10. Testing Contract

Key test scenarios:

1. Activating `selected` resolves correct state props.
2. Multiple simultaneous states merge in activation order.
3. `setExclusive` clears the state on all other group members.
4. Interactive states (`hovered`, `pressed`) are triggered by the editor event system.
5. Persistent states survive session reload if `persisted: true`.
6. Resolved state props are not persisted into `node.props`.

## 11. Relationship To Other Specs

- `domain-model.md`: `SceneNode`, `SceneNode.activeStates`, `SceneNode.runtime`
- `plugin-system.md`: `NodeRenderContext`, `ComponentPlugin`
- `component-types.md`: per-component props and metadata
- `engine-api.md`: `StateService` surface for plugins
- `editor-interaction.md`: interactive state lifecycle
