# Component Types

## 1. Scope

This document defines the built-in component types owned by the engine core, and the default plugin component types shipped as installable plugins. All components are registered through `PluginRegistry` as defined in `plugin-system.md`.

## 2. Built-in Types

The engine ships three types directly in core. They are always available and cannot be unregistered. Built-in types are registered automatically by the engine before any plugin registration runs; they are populated into `PluginRegistry` via an internal `registerBuiltins()` call at engine initialization, not through the public `registerComponent` API.

### 2.1 container

A generic grouping container. Node without visual output; its purpose is layout and hierarchy.

```ts
interface ContainerProps {
  direction?: 'horizontal' | 'vertical'
  gap?: number
  align?: 'start' | 'center' | 'end' | 'stretch'
  justify?: 'start' | 'center' | 'end' | 'space-between'
  padding?: number
}
```

Plugin registration:

```ts
const containerPlugin: ComponentPlugin = {
  type: 'container',
  renderer: ContainerRenderer,
  meta: {
    title: 'Container',
    description: 'Generic layout container for grouping child nodes.',
    category: 'container',
    props: [
      { key: 'direction', type: 'string', default: 'vertical' },
      { key: 'gap', type: 'number', default: 16 },
      { key: 'align', type: 'string', default: 'stretch' },
      { key: 'justify', type: 'string', default: 'start' },
      { key: 'padding', type: 'number', default: 16 },
    ],
    ai: {
      usage: ['grouping related widgets', 'dashboard section wrapper'],
      antiPatterns: ['using container for single-child layout only'],
    },
  },
  constraints: [
    { type: 'structural', rule: 'children.length >= 0' },
  ],
}
```

### 2.2 grid

The primary grid layout container.

```ts
interface GridProps {
  columns: number
  rowHeight: number
  gap: number
  autoFlow?: 'row' | 'column'
}
```

Plugin registration:

```ts
const gridPlugin: ComponentPlugin = {
  type: 'grid',
  renderer: GridRenderer,
  meta: {
    title: 'Grid',
    description: 'Responsive grid layout container.',
    category: 'container',
    props: [
      { key: 'columns', type: 'number', default: 12 },
      { key: 'rowHeight', type: 'number', default: 80 },
      { key: 'gap', type: 'number', default: 16 },
      { key: 'autoFlow', type: 'string', default: 'row' },
    ],
    ai: {
      usage: ['dashboard page layout', 'KPI card grid', 'chart grid'],
      antiPatterns: ['placing grid inside another grid without explicit intention'],
    },
  },
  constraints: [
    { type: 'layout', rule: 'columns >= 1' },
    { type: 'layout', rule: 'rowHeight >= 1' },
    { type: 'layout', rule: 'all children must use grid-item layout' },
  ],
}
```

### 2.3 text

A rich text block powered by Tiptap. Content is stored as a Tiptap JSON document. See `rich-text.md` for the content model.

```ts
interface TextProps {
  content: DocNode
  placeholder?: string
  editable?: boolean
}
```

Plugin registration:

```ts
const textPlugin: ComponentPlugin = {
  type: 'text',
  renderer: TextRenderer,
  meta: {
    title: 'Text',
    description: 'Rich text block powered by Tiptap. Supports headings, lists, inline formatting, and links.',
    category: 'display',
    props: [
      { key: 'content', type: 'json', default: '{"type":"doc","content":[{"type":"paragraph"}]}' },
      { key: 'placeholder', type: 'string' },
      { key: 'editable', type: 'boolean', default: true },
    ],
    ai: {
      usage: ['page title', 'section description', 'annotation', 'data footnote'],
      antiPatterns: ['using text block for structured data that belongs in a table or chart'],
    },
  },
  constraints: [
    { type: 'structural', rule: 'content must be a valid Tiptap JSON document' },
  ],
}
```

## 3. Default Plugins

The following types are shipped as default plugins alongside the engine. They are installed via `PluginRegistry.register()` at app startup and can be replaced or extended by downstream consumers.

### 3.1 metric-value

```ts
interface MetricValueProps {
  label: string
  value: number | string
  format?: 'number' | 'currency' | 'percent'
  prefix?: string
  suffix?: string
  color?: string
}
```

Plugin registration:

```ts
const metricValuePlugin: ComponentPlugin = {
  type: 'metric-value',
  renderer: MetricValueRenderer,
  meta: {
    title: 'Metric Value',
    description: 'Single metric display with label and value.',
    category: 'display',
    props: [
      { key: 'label', type: 'string', default: 'Metric' },
      { key: 'value', type: 'number', default: 0 },
      { key: 'format', type: 'string', default: 'number' },
      { key: 'prefix', type: 'string' },
      { key: 'suffix', type: 'string' },
      { key: 'color', type: 'string' },
    ],
    ai: {
      usage: ['single KPI display', 'summary statistic', 'total count'],
      antiPatterns: ['using metric-value when trend or comparison context is needed'],
    },
  },
  constraints: [
    { type: 'semantic', rule: 'value must be a valid number or string' },
  ],
}
```

### 3.2 metric-trend

```ts
interface MetricTrendProps {
  label: string
  value: number | string
  trendData: number[]
  trendDirection?: 'up' | 'down' | 'flat'
  changePercent?: number
  format?: 'number' | 'currency' | 'percent'
}
```

Plugin registration:

```ts
const metricTrendPlugin: ComponentPlugin = {
  type: 'metric-trend',
  renderer: MetricTrendRenderer,
  meta: {
    title: 'Metric Trend',
    description: 'Metric with inline sparkline and directional indicator.',
    category: 'display',
    props: [
      { key: 'label', type: 'string', default: 'Trend' },
      { key: 'value', type: 'number', default: 0 },
      { key: 'trendData', type: 'json', default: [] },
      { key: 'trendDirection', type: 'string', default: 'flat' },
      { key: 'changePercent', type: 'number' },
      { key: 'format', type: 'string', default: 'number' },
    ],
    ai: {
      usage: ['revenue trend', 'growth metric', 'time-series KPI'],
      antiPatterns: ['using metric-trend with fewer than 3 data points'],
    },
    relatedComponents: ['metric-value', 'metric-comparison', 'chart'],
  },
  constraints: [
    { type: 'semantic', rule: 'trendData.length >= 2' },
  ],
}
```

### 3.3 metric-comparison

```ts
interface MetricComparisonProps {
  label: string
  value: number | string
  compareValue?: number | string
  compareLabel?: string
  changePercent?: number
  format?: 'number' | 'currency' | 'percent'
}
```

Plugin registration:

```ts
const metricComparisonPlugin: ComponentPlugin = {
  type: 'metric-comparison',
  renderer: MetricComparisonRenderer,
  meta: {
    title: 'Metric Comparison',
    description: 'Metric with comparison value and percentage change.',
    category: 'display',
    props: [
      { key: 'label', type: 'string', default: 'Comparison' },
      { key: 'value', type: 'number', default: 0 },
      { key: 'compareValue', type: 'number' },
      { key: 'compareLabel', type: 'string' },
      { key: 'changePercent', type: 'number' },
      { key: 'format', type: 'string', default: 'number' },
    ],
    ai: {
      usage: ['YoY comparison', 'MoM change', 'budget vs actual'],
      antiPatterns: ['using metric-comparison without providing compareValue or changePercent'],
    },
    relatedComponents: ['metric-value', 'metric-trend'],
  },
  constraints: [
    { type: 'semantic', rule: 'at least one of compareValue or changePercent should be present' },
  ],
}
```

### 3.4 chart

```ts
interface ChartProps {
  chartType: 'line' | 'bar' | 'pie'
  xKey?: string
  yKey?: string
  title?: string
  stacked?: boolean
  showLegend?: boolean
  height?: number
}
```

Plugin registration:

```ts
const chartPlugin: ComponentPlugin = {
  type: 'chart',
  renderer: ChartRenderer,
  meta: {
    title: 'Chart',
    description: 'Line, bar, or pie chart driven by data bindings.',
    category: 'display',
    props: [
      { key: 'chartType', type: 'string', default: 'bar' },
      { key: 'xKey', type: 'string' },
      { key: 'yKey', type: 'string' },
      { key: 'title', type: 'string' },
      { key: 'stacked', type: 'boolean', default: false },
      { key: 'showLegend', type: 'boolean', default: true },
      { key: 'height', type: 'number', default: 300 },
    ],
    ai: {
      usage: ['revenue by month', 'sales by region', 'category breakdown'],
      antiPatterns: ['using pie chart for more than 10 categories', 'using bar chart for time-series data'],
    },
    relatedComponents: ['metric-value', 'table'],
  },
  constraints: [
    { type: 'semantic', rule: 'must have data binding to a dataset' },
    { type: 'layout', rule: 'height >= 100' },
  ],
}
```

### 3.5 table

```ts
interface TableProps {
  columns?: { key: string; label: string }[]
  pageSize?: number
  sortable?: boolean
  striped?: boolean
}
```

Plugin registration:

```ts
const tablePlugin: ComponentPlugin = {
  type: 'table',
  renderer: TableRenderer,
  meta: {
    title: 'Table',
    description: 'Paginated data table driven by data bindings.',
    category: 'display',
    props: [
      { key: 'columns', type: 'json' },
      { key: 'pageSize', type: 'number', default: 20 },
      { key: 'sortable', type: 'boolean', default: true },
      { key: 'striped', type: 'boolean', default: true },
    ],
    ai: {
      usage: ['detailed data view', 'transaction list', 'raw data inspection'],
      antiPatterns: ['using table for a single row of data', 'using table when a chart is more appropriate'],
    },
    relatedComponents: ['chart'],
  },
  constraints: [
    { type: 'semantic', rule: 'must have data binding to a dataset' },
  ],
}
```

### 3.6 header

```ts
interface HeaderProps {
  title: string
  subtitle?: string
  level?: 1 | 2 | 3
}
```

Plugin registration:

```ts
const headerPlugin: ComponentPlugin = {
  type: 'header',
  renderer: HeaderRenderer,
  meta: {
    title: 'Header',
    description: 'Page or section header with title and optional subtitle.',
    category: 'layout',
    props: [
      { key: 'title', type: 'string', default: 'Untitled' },
      { key: 'subtitle', type: 'string' },
      { key: 'level', type: 'number', default: 1 },
    ],
    ai: {
      usage: ['page title', 'dashboard name', 'section heading'],
      antiPatterns: ['using header for body text'],
    },
  },
}
```

### 3.7 divider

```ts
interface DividerProps {
  label?: string
  orientation?: 'horizontal' | 'vertical'
  style?: 'solid' | 'dashed'
}
```

Plugin registration:

```ts
const dividerPlugin: ComponentPlugin = {
  type: 'divider',
  renderer: DividerRenderer,
  meta: {
    title: 'Divider',
    description: 'Visual separator between sections.',
    category: 'layout',
    props: [
      { key: 'label', type: 'string' },
      { key: 'orientation', type: 'string', default: 'horizontal' },
      { key: 'style', type: 'string', default: 'solid' },
    ],
    ai: {
      usage: ['section separator', 'visual grouping boundary'],
      antiPatterns: ['using multiple dividers without content between them'],
    },
  },
}
```

### 3.8 filter

```ts
interface FilterProps {
  filterType: 'dropdown' | 'date-range' | 'text'
  label: string
  dataKey: string
  placeholder?: string
  options?: { label: string; value: string }[]
}
```

Plugin registration:

```ts
const filterPlugin: ComponentPlugin = {
  type: 'filter',
  renderer: FilterRenderer,
  meta: {
    title: 'Filter',
    description: 'Interactive filter control that drives data bindings on the same page.',
    category: 'interaction',
    props: [
      { key: 'filterType', type: 'string', default: 'dropdown' },
      { key: 'label', type: 'string', default: 'Filter' },
      { key: 'dataKey', type: 'string' },
      { key: 'placeholder', type: 'string' },
      { key: 'options', type: 'json' },
    ],
    ai: {
      usage: ['date filter for dashboard', 'category selector', 'search box'],
      antiPatterns: ['placing filter on a different page from the data it affects'],
    },
  },
  constraints: [
    { type: 'semantic', rule: 'dataKey must reference a variable or dataset column' },
  ],
}
```

## 4. Default Plugin Installation

All default plugins are registered at app startup.

```ts
// packages/editor/src/plugins/index.ts
import { PluginRegistry } from '@ai-native/core'

import { metricValuePlugin } from './metric-value'
import { metricTrendPlugin } from './metric-trend'
import { metricComparisonPlugin } from './metric-comparison'
import { chartPlugin } from './chart'
import { tablePlugin } from './table'
import { headerPlugin } from './header'
import { dividerPlugin } from './divider'
import { filterPlugin } from './filter'

export function registerDefaultPlugins(registry: PluginRegistry): void {
  registry.registerComponent(metricValuePlugin)
  registry.registerComponent(metricTrendPlugin)
  registry.registerComponent(metricComparisonPlugin)
  registry.registerComponent(chartPlugin)
  registry.registerComponent(tablePlugin)
  registry.registerComponent(headerPlugin)
  registry.registerComponent(dividerPlugin)
  registry.registerComponent(filterPlugin)
}
```

Rules:

1. Default plugins are installed before any user-defined plugins.
2. A downstream consumer may replace any default plugin by registering a plugin with the same `type`.
3. The engine core ships only `container`, `grid`, and `text`.
4. The compiler's `create-dashboard` expansion must produce only types registered at that moment.
5. If a referenced type is not registered, the compiler emits `compiler.unknown-component`.
6. Each default plugin exports a Zod props schema alongside its `ComponentPlugin` definition. The schema is registered via `SchemaRegistry.registerPluginPropsSchema()` at the same time the plugin itself is registered. See `schema-validation.md` §4.2.

## 5. Relationship To Other Specs

- `plugin-system.md`: `ComponentPlugin`, `PluginRegistry`, `Renderer`
- `domain-model.md`: `SceneNode.type`, `SceneNode.props`
- `semantic-system.md`: compiler expansion from semantic actions
- `renderer-contract.md`: renderer resolution and fallback
