# Constraints And Validation

## 1. Scope

This document defines the constraint system used by runtime validation, semantic compilation, and editor assistance.

## 2. Goals

Constraints exist to prevent invalid structure, layout breakage, semantic degradation, and theme violations.

The engine must support constraints at four levels:

1. structural
2. layout
3. semantic
4. theme

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

1. chart must be inside a valid container
2. grid-item must be child of grid
3. forbidden child type under specific parent
4. root node cannot be removed

Structural constraints should run:

1. before runtime action commit
2. during semantic planning
3. during scene import

## 5. Layout Constraints

Examples:

1. grid item cannot exceed column count
2. widget cannot have negative width or height
3. resized node must respect min and max bounds
4. absolute child cannot exceed locked container bounds if strict clipping is enabled

Layout constraints may return:

1. hard error
2. soft warning
3. normalized correction if deterministic normalization is explicitly allowed

Any auto-correction must be predictable and documented.

## 6. Semantic Constraints

Examples:

1. dashboard should contain at least one KPI card
2. finance dashboard should prefer table plus trend chart
3. page routes must be unique
4. required data binding missing for data-driven component

Semantic constraints are especially important in the compiler stage.

## 7. Theme Constraints

Examples:

1. dark mode forbids low-contrast light-gray body text
2. danger actions require approved palette tokens
3. text and surface contrast must meet accessibility threshold

Theme constraints may apply to:

1. component style props
2. global themes
3. AI-generated visual variants

## 8. Validation Layers

Validation should happen at multiple layers:

1. schema validation
   Ensures payload shapes are correct.

2. referential validation
   Ensures IDs point to valid objects.

3. structural validation
   Ensures tree legality.

4. semantic validation
   Ensures product meaning and template completeness.

5. presentation validation
   Ensures theme and visibility rules.

## 9. Validation Timing

Validation should occur at these checkpoints:

1. on scene import
2. before runtime action commit
3. during semantic compilation
4. before persistence export
5. in background diagnostics for editor hints

## 10. Failure Policy

Constraint failure behavior:

1. `error`
   Blocks commit or compilation.

2. `warning`
   Allows commit but surfaces issue in diagnostics.

3. `info`
   Optional future level for non-blocking suggestions.

MVP should implement `error` and `warning`.
