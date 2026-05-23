# Constraints And Validation

## 1. Scope

This document defines the constraint system used by runtime validation, semantic compilation, and editor assistance.

## 2. Goals

Constraints exist to prevent invalid structure, layout breakage, semantic degradation, and theme violations.

The engine must support constraints at four levels:

1. Structural.
2. Layout.
3. Semantic.
4. Theme.

## 3. Constraint Model

```ts
export interface Constraint {
  id: string
  type: 'structural' | 'layout' | 'semantic' | 'theme'
  message: string
  severity: 'error' | 'warning'
  evaluate(input: ConstraintInput): ConstraintResult
}

export interface ConstraintInput {
  document?: VisualDocument
  scene: SceneGraph
  node?: SceneNode
  action?: RuntimeAction
}

export interface ConstraintResult {
  pass: boolean
  code?: string
  message?: string
}
```

The runtime representation of constraints may need serialization-friendly forms later. The interface above is conceptual and may be implemented as declarative rules or registered functions.

## 4. Structural Constraints

Examples:

1. Chart must be inside a valid container.
2. Grid-item must be child of grid.
3. Forbidden child type under specific parent.
4. Root node cannot be removed.

Structural constraints should run:

1. Before runtime action commit.
2. During semantic planning.
3. During scene import.

## 5. Layout Constraints

Examples:

1. Grid item cannot exceed column count.
2. Widget cannot have negative width or height.
3. Resized node must respect min and max bounds.
4. Absolute child cannot exceed locked container bounds if strict clipping is enabled.

Layout constraints may return:

1. Hard error.
2. Soft warning.
3. Normalized correction if deterministic normalization is explicitly allowed.

Any auto-correction must be predictable and documented.

Default policy:

1. Invalid geometry is rejected at commit time.
2. Preview systems and semantic planners may suggest repairs before commit.
3. Runtime commit may only normalize values when an explicit deterministic rule is documented for that field.

## 6. Semantic Constraints

Examples:

1. Dashboard should contain at least one KPI card.
2. Finance dashboard should prefer table plus trend chart.
3. Page routes must be unique.
4. Required data binding missing for data-driven component.

Semantic constraints are especially important in the compiler stage.

## 7. Theme Constraints

Examples:

1. Dark mode forbids low-contrast light-gray body text.
2. Danger actions require approved palette tokens.
3. Text and surface contrast must meet accessibility threshold.

Theme constraints may apply to:

1. Component style props.
2. Global themes.
3. AI-generated visual variants.

## 8. Validation Layers

Validation should happen at multiple layers:

1. Schema validation.
   Ensures payload shapes are correct.

2. Referential validation.
   Ensures IDs point to valid objects.

3. Structural validation.
   Ensures tree legality.

4. Semantic validation.
   Ensures product meaning and template completeness.

5. Presentation validation.
   Ensures theme and visibility rules.

## 9. Validation Timing

Validation should occur at these checkpoints:

1. On scene import.
2. Before runtime action commit.
3. During semantic compilation.
4. Before persistence export.
5. In background diagnostics for editor hints.

## 10. Failure Policy

Constraint failure behavior:

1. `error`
   Blocks commit or compilation.

2. `warning`
   Allows commit but surfaces issue in diagnostics.

3. `info`
   Optional future level for non-blocking suggestions.

MVP should implement `error` and `warning`.
