# Theme And Tokens

## 1. Scope

This document defines the theme model, token system, cascade rules, and the engine's contract for resolving visual styles from themes at render time.

## 2. Theme Model

A theme is a named collection of design tokens owned by the document.

```ts
export interface Theme {
  id: string
  name: string
  mode?: 'light' | 'dark'
  tokens: ThemeTokens
}

export interface ThemeTokens {
  colors?: ColorTokens
  spacing?: SpacingTokens
  typography?: TypographyTokens
  borders?: BorderTokens
  shadows?: ShadowTokens
}
```

Rules:

1. Every document may carry zero or more themes.
2. `VisualDocument.activeThemeId` defines the default document theme.
3. `Page.themeId` overrides the document theme for that page.
4. If no theme is active, the engine uses a built-in base theme.

## 3. Token Definitions

### 3.1 Color Tokens

```ts
export interface ColorTokens {
  background?: string
  surface?: string
  surfaceVariant?: string
  textPrimary?: string
  textSecondary?: string
  textMuted?: string
  border?: string
  borderFocus?: string
  accent?: string
  accentHover?: string
  danger?: string
  success?: string
  warning?: string
  chart?: Record<string, string>
}
```

### 3.2 Spacing Tokens

```ts
export interface SpacingTokens {
  unit: number
  xs?: number
  sm?: number
  md?: number
  lg?: number
  xl?: number
  componentGap?: number
  sectionGap?: number
}
```

### 3.3 Typography Tokens

```ts
export interface TypographyTokens {
  fontFamily?: string
  fontFamilyMono?: string
  fontSizeRoot?: number
  headingScale?: number
  bodyScale?: number
  fontWeightHeading?: number
  fontWeightBody?: number
  lineHeight?: number
}
```

### 3.4 Border Tokens

```ts
export interface BorderTokens {
  radiusSm?: number
  radiusMd?: number
  radiusLg?: number
  width?: number
}
```

### 3.5 Shadow Tokens

```ts
export interface ShadowTokens {
  sm?: string
  md?: string
  lg?: string
}
```

## 4. Token Cascade

Theme resolution follows a strict cascade order.

```text
1. Inline SceneNode.style (highest priority)
2. Component plugin default style
3. Page.themeId tokens
4. VisualDocument.activeThemeId tokens
5. Engine built-in base theme (lowest priority)
```

Rules:

1. Each level only overrides tokens it explicitly defines.
2. Missing tokens at a higher level fall through to the next level.
3. The resolved style for a node is computed at render time and is never persisted back into the scene graph.
4. If a referenced `Page.themeId` or `VisualDocument.activeThemeId` does not resolve, that level is skipped.

### 4.1 Override Example

```text
Built-in base theme:
  background: #ffffff
  textPrimary: #111111

Document theme (activeThemeId = 'corp'):
  background: #f5f5f5
  accent: #3366ff

Page override (page.themeId = 'sales-dash'):
  background: #ffffff
  textPrimary: #222222

Node inline style:
  background: #fff8e1

Resolved:
  background: #fff8e1    (node inline wins)
  textPrimary: #222222   (page override wins)
  accent: #3366ff        (document theme wins)
```

## 5. Built-in Base Theme

The engine ships with a minimal base theme so the editor and runtime are usable without any user-defined theme.

```json
{
  "colors": {
    "background": "#ffffff",
    "surface": "#f8f9fa",
    "textPrimary": "#111111",
    "textSecondary": "#555555",
    "border": "#e0e0e0",
    "accent": "#3366ff"
  },
  "spacing": {
    "unit": 4,
    "componentGap": 16,
    "sectionGap": 32
  },
  "typography": {
    "fontFamily": "Inter, system-ui, sans-serif",
    "fontSizeRoot": 16
  },
  "borders": {
    "radiusMd": 8
  }
}
```

## 6. Theme Management Actions

Themes are managed through document actions defined in `document-runtime.md`.

1. `set-document-theme` updates or clears `VisualDocument.activeThemeId`.
2. `set-page-theme` updates or clears `Page.themeId`.
3. Creating and deleting themes themselves is a post-MVP concern; the MVP ships with a fixed set of themes.

## 7. AI Theme Intent

AI may request theme changes through `update-theme-intent` (see `semantic-system.md` §3.4).

1. The compiler resolves the intent to `set-document-theme` and/or `set-page-theme` document actions.
2. If the requested `themeId` does not exist, the compiler emits a diagnostic.
3. `mode` hints (`'light' | 'dark'`) are used to select among available themes.

## 8. Renderer Integration

The renderer consumes resolved tokens via the theme cascade.

```ts
export interface ResolvedTheme {
  colors: Required<ColorTokens>
  spacing: Required<SpacingTokens>
  typography: Required<TypographyTokens>
  borders: Required<BorderTokens>
  shadows: Required<ShadowTokens>
}

export function resolveTheme(
  scene: SceneGraph,
  document: VisualDocument,
  node?: SceneNode
): ResolvedTheme
```

Rules:

1. `resolveTheme` must be called by the renderer, not stored.
2. The resolved theme is a read-only snapshot at render time.
3. The renderer must never write resolved values back into the scene graph.

## 9. Theme Validation

Themes must pass validation before being set as active.

1. `activeThemeId` must reference a theme that exists in `VisualDocument.themes`.
2. If the referenced theme is deleted, the active theme falls back to the built-in base theme.
3. Theme tokens are validated against their type definitions; unknown keys are preserved but ignored during resolution.

## 10. Relationship To Other Specs

- `domain-model.md`: `Theme`, `VisualDocument`, `Page`, `SceneNode.style`
- `document-runtime.md`: `set-document-theme`, `set-page-theme`
- `semantic-system.md`: `update-theme-intent`, compiler theme resolution
- `renderer-contract.md`: style and theme application
