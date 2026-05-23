# Data Interaction

## 1. Scope

This document defines how data-display components interact with each other and with filter controls: cross-filtering, drill-down, drill-through, and filter value propagation. It extends `data-binding.md` with the interactive binding lifecycle.

## 2. Interactive Binding

A binding is static by default. An interactive binding adds a parameterized filter context that changes at runtime.

```ts
export interface InteractiveBinding extends Binding {
  filterParams?: Record<string, unknown>
}

export interface FilterParam {
  key: string
  value: unknown
  operator: 'eq' | 'neq' | 'in' | 'gt' | 'gte' | 'lt' | 'lte' | 'between' | 'like'
}
```

Rules:

1. When `filterParams` is empty or absent, the binding resolves the full dataset.
2. When `filterParams` is present, the binding resolves the dataset filtered by those parameters.
3. Filter parameters are applied at the `DataSourceRegistry` level before `path` traversal.
4. After re-resolve, the renderer updates only the affected components.

## 3. Cross-Filtering

When a user interacts with a data-display component (e.g., clicks a bar in a chart), other components on the same page filter their data to match.

### 3.1 Selection Event

```ts
export interface SelectionEvent {
  sourceComponentId: NodeId
  sourceComponentType: string
  dimension: string
  value: unknown
  label: string
}
```

Example: clicking the "Q1" bar in a revenue chart produces:

```ts
{
  sourceComponentId: 'chart-1',
  sourceComponentType: 'chart',
  dimension: 'quarter',
  value: 'Q1',
  label: 'Q1 2026'
}
```

### 3.2 Subscription Model

Components declare which dimensions they accept as cross-filter input.

```ts
export interface CrossFilterSubscription {
  dimension: string
  dataKey: string
}

// Per component type
const chartCrossFilters: CrossFilterSubscription[] = [
  { dimension: 'quarter', dataKey: 'quarter' },
  { dimension: 'region', dataKey: 'region' },
  { dimension: 'category', dataKey: 'category' },
]

const tableCrossFilters: CrossFilterSubscription[] = [
  { dimension: 'quarter', dataKey: 'quarter' },
  { dimension: 'region', dataKey: 'region' },
]
```

### 3.3 Propagation Flow

```text
User clicks bar in chart-1
  -> Editor captures SelectionEvent { dimension: 'region', value: 'EMEA' }
  -> Engine broadcasts event to all components on the active page
  -> Each subscribed component receives the filter
  -> Component re-resolves its data binding with FilterParam { key: 'region', value: 'EMEA' }
  -> Renderer updates
```

Rules:

1. Cross-filtering is page-scoped. Filters do not cross page boundaries.
2. A component may accumulate multiple filter params from different sources.
3. Clearing a selection resets the associated filter params to empty.
4. The filter component itself may also emit `SelectionEvent` (see §6).
5. Cross-filtering does not produce runtime actions; it is a read-only resolution concern.

### 3.4 Priority And Conflict

When multiple components select different values on the same dimension:

```text
Chart-1 selects region = 'EMEA'
Chart-2 selects region = 'APAC'
```

Resolution:

1. The last selection wins for that dimension across all subscribed components.
2. A component that emitted a selection is not filtered by its own selection.
3. The editor may optionally support multi-select on dimensions with `operator: 'in'`.

## 4. Drill-Down

Drill-down allows the user to navigate from aggregated data to finer granularity.

### 4.1 Drill Hierarchy

```ts
export interface DrillDimension {
  name: string
  children?: DrillDimension[]
}

// Example hierarchy
const timeDrillHierarchy: DrillDimension = {
  name: 'year',
  children: {
    name: 'quarter',
    children: {
      name: 'month',
      children: { name: 'day' },
    },
  },
}

const categoryDrillHierarchy: DrillDimension = {
  name: 'category',
  children: { name: 'subcategory' },
}
```

### 4.2 Drill State

Each component tracks its drill state independently.

```ts
export interface DrillState {
  currentDimension: string
  currentValue: string | null
  parentPath: { dimension: string; value: string }[]
  availableDimensions: string[]
}
```

Example drill state:

```ts
// Viewing Q1 revenue, drilled from 2026
{
  currentDimension: 'quarter',
  currentValue: null,
  parentPath: [{ dimension: 'year', value: '2026' }],
  availableDimensions: ['month'],
}
```

### 4.3 Drill Flow

```text
Chart displays revenue by year
  -> User clicks "2026" bar and selects "Drill down"
  -> Drill state updates: parentPath adds { dimension: 'year', value: '2026' }
  -> currentDimension becomes 'quarter'
  -> Binding re-resolves with filter: { year: '2026' }
  -> Chart renders revenue by quarter for 2026
  -> User clicks "Q1" bar and drills again
  -> Binding re-resolves with filter: { year: '2026', quarter: 'Q1' }
  -> Chart renders revenue by month for Q1 2026

User clicks "Drill up"
  -> Pop the last parentPath entry
  -> Restore previous dimension
  -> Re-resolve
```

Rules:

1. Drill-down is per-component. Chart-1 drilling does not affect Chart-2.
2. Cross-filtering and drill-down combine: a drilled chart that emits a selection still cross-filters other components.
3. Drill state is session-scoped. It does not persist in `DocumentSnapshot`.
4. A component without a defined drill hierarchy cannot be drilled.

### 4.4 Drill-Down And The Renderer

The renderer must support a drill indicator.

1. When `drillState.currentDimension` has children available, the component renders a drill affordance (e.g., clickable bar with a "+" cursor).
2. The drill-up affordance is shown when `parentPath` is non-empty.
3. The renderer must not mutate the scene graph to implement drill-down.

## 5. Drill-Through

Drill-through navigates from a data point to a separate detail view.

### 5.1 Drill-Through Target

```ts
export interface DrillThroughTarget {
  pageId: PageId
  params: Record<string, unknown>
  label: string
}
```

### 5.2 Drill-Through Flow

```text
User right-clicks a table row representing "Customer ABC"
  -> Editor shows context menu with available drill-through targets
  -> "View Customer Detail" maps to pageId 'customer-detail' with params { customerId: 'ABC' }
  -> Engine activates page 'customer-detail'
  -> Page 'customer-detail' has bindings that reference the params
  -> Components on the target page re-resolve with the passed params
  -> Renderer updates
```

Rules:

1. Drill-through targets are defined per component type in plugin metadata.
2. The target page must accept the params defined by the drill-through target.
3. Drill-through does not create new scene nodes or runtime actions.
4. The user may return to the previous page; drill-through state is session-scoped.

### 5.3 Component Registration

```ts
// In chart plugin metadata
drillThrough: [
  {
    targetPageId: 'customer-detail',
    params: ['customerId'],
    label: 'View Customer Detail',
  },
]
```

## 6. Filter Component Integration

The `filter` component is the primary driver of cross-filtering and drill-down from user input.

### 6.1 Filter Value Emission

```ts
// When a user changes a filter control value
export interface FilterChangeEvent {
  filterComponentId: NodeId
  dimension: string
  value: unknown
  operator: FilterParam['operator']
}
```

Rules:

1. A `filter` component emits `FilterChangeEvent` on value change.
2. The engine converts `FilterChangeEvent` to `SelectionEvent` for cross-filtering.
3. A `filter` may be configured to apply to specific target components rather than broadcasting globally.

### 6.2 Filter Persistence

1. Filter values are session-scoped by default.
2. If a page has a default filter state, it is stored in `Page.metadata` as a serializable filter preset.
3. The filter preset is applied on page activation.

```ts
export interface FilterPreset {
  filterComponentId: NodeId
  dimension: string
  value: unknown
}
```

## 7. Interaction Lifecycle

The full interactive data flow from user action to renderer update.

```text
User action (click, select, filter change)
  -> Editor captures event
  -> Engine computes impact:
       Cross-filter? -> Broadcast SelectionEvent
       Drill-down?   -> Update DrillState, re-resolve binding
       Drill-through?-> Activate target page with params
       Filter change?-> Convert to SelectionEvent + optional preset
  -> Affected components re-resolve bindings
  -> Renderer updates only affected nodes
```

Rules:

1. The interaction pipeline is read-only with respect to the scene graph.
2. No runtime actions or document actions are produced.
3. The renderer must support partial updates — only re-render nodes whose resolved bindings changed.
4. The entire pipeline runs synchronously within a single frame.

## 8. Data Interaction API

The engine exposes a `DataInteractionAPI` that plugins and components call to trigger interactive behavior without knowing the internal event bus.

```ts
export interface DataInteractionAPI {
  crossFilter(selection: SelectionEvent): void
  drillDown(componentId: NodeId, dimension: string, value: string): void
  drillUp(componentId: NodeId): void
  drillThrough(componentId: NodeId, target: DrillThroughTarget): void
  setFilter(componentId: NodeId, dimension: string, value: unknown): void
  clearFilter(componentId: NodeId): void
  getDrillState(componentId: NodeId): DrillState | undefined
  getFilterState(componentId: NodeId): FilterParam[]
  subscribe(componentId: NodeId, dimensions: string[], callback: (params: FilterParam[]) => void): () => void
}
```

### 8.1 crossFilter

Emit a selection event from a component. Subscribed components on the same page re-resolve their bindings with the new filter.

```ts
api.crossFilter({
  sourceComponentId: 'chart-1',
  sourceComponentType: 'chart',
  dimension: 'region',
  value: 'APAC',
  label: 'Asia Pacific',
})
```

### 8.2 drillDown / drillUp

Navigate down or up the drill hierarchy for a component.

```ts
// Drill from year to quarter for the selected value
api.drillDown('chart-1', 'year', '2026')

// Go back to the previous level
api.drillUp('chart-1')
```

### 8.3 drillThrough

Navigate to a detail page with context parameters.

```ts
api.drillThrough('table-1', {
  pageId: 'customer-detail',
  params: { customerId: 'ABC' },
  label: 'View Customer Detail',
})
```

### 8.4 setFilter / clearFilter

Programmatically set or clear a filter on a filter component. Equivalent to user interaction with the filter control.

```ts
api.setFilter('filter-region', 'region', 'EMEA')
api.clearFilter('filter-region')
```

### 8.5 getDrillState / getFilterState

Read the current drill or filter state for a component. Used by the renderer to show drill indicators and active filter badges.

```ts
const state = api.getDrillState('chart-1')
if (state && state.availableDimensions.length > 0) {
  renderDrillAffordance()
}
```

### 8.6 subscribe

Subscribe to filter parameter changes for one or more dimensions. The callback fires whenever any matching filter changes, allowing the renderer to re-resolve bindings.

```ts
const unsubscribe = api.subscribe('chart-1', ['region', 'quarter'], (params) => {
  for (const binding of node.bindings) {
    const resolved = registry.resolveValue(binding.source, binding.path, params)
    updateComponent(chart, resolved)
  }
})

// When done
unsubscribe()
```

### 8.7 How The API Is Provided

The engine provides `DataInteractionAPI` to plugins through the `RenderNodeInput` context.

```ts
// In plugin renderer
export function ChartRenderer(input: RenderNodeInput): RenderedOutput {
  const { node, context } = input
  const api = context.dataInteraction

  return <ChartView
    data={resolvedBinding.value}
    onBarClick={(dimension, value) => api.crossFilter({
      sourceComponentId: node.id,
      sourceComponentType: node.type,
      dimension,
      value,
      label: String(value),
    })}
    onDrillDown={(dimension, value) => api.drillDown(node.id, dimension, value)}
  />
}
```

Rules:

1. The API is read-only with respect to the scene graph. It triggers re-resolution, not mutation.
2. All API calls are synchronous.
3. `subscribe` callbacks fire synchronously within the same frame.
4. Plugins call the API in response to user gestures (click, select, filter change).
5. The API is provided through `RenderNodeInput.context`, not through a global singleton.

## 9. Testing Contract

See `testing-and-fixtures.md`. Key data-interaction test scenarios:

1. Clicking a chart bar cross-filters a table on the same page.
2. Drilling down from year to quarter re-resolves and renders correctly.
3. Drilling up restores the previous aggregation level.
4. Drill-through activates the target page with correct params.
5. Filter change cross-filters all subscribed components.
6. Clearing a filter resets affected components to full dataset.
7. Multiple concurrent selections on different dimensions accumulate correctly.
8. A component is not cross-filtered by its own selection.

## 10. Relationship To Other Specs

- `data-binding.md`: `Binding`, `DataSourceRegistry`, resolution lifecycle
- `component-types.md`: per-component props, constraints, and metadata
- `domain-model.md`: `SceneNode`, `Page`, session-scoped state
- `editor-interaction.md`: selection events and user gesture mapping
- `renderer-contract.md`: renderer re-render contract
- `testing-and-fixtures.md`: data interaction test scenarios
