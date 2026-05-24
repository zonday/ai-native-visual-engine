import type { Page, Theme, VisualDocument } from "./types.js";

export const BASE_THEME: Theme = {
  id: "base",
  name: "Base",
  mode: "light",
  tokens: {
    colors: {
      background: "#ffffff",
      surface: "#f8f9fa",
      surfaceVariant: "#e9ecef",
      textPrimary: "#212529",
      textSecondary: "#6c757d",
      textMuted: "#adb5bd",
      border: "#dee2e6",
      borderFocus: "#3b82f6",
      accent: "#3b82f6",
      accentHover: "#2563eb",
      danger: "#ef4444",
      success: "#22c55e",
      warning: "#f59e0b",
    },
    spacing: {
      unit: 4,
      xs: 4,
      sm: 8,
      md: 16,
      lg: 24,
      xl: 32,
      componentGap: 8,
      sectionGap: 16,
    },
    typography: {
      fontFamily: "system-ui, sans-serif",
      fontFamilyMono: "ui-monospace, monospace",
      fontSizeRoot: 14,
      headingScale: 1.25,
      bodyScale: 1,
      fontWeightHeading: 600,
      fontWeightBody: 400,
      lineHeight: 1.5,
    },
    borders: {
      radiusSm: 2,
      radiusMd: 4,
      radiusLg: 8,
      width: 1,
    },
    shadows: {
      sm: "0 1px 2px rgba(0,0,0,0.05)",
      md: "0 4px 6px rgba(0,0,0,0.1)",
      lg: "0 10px 15px rgba(0,0,0,0.1)",
    },
  },
};

export function resolveTheme(
  page: Page,
  document: VisualDocument,
  themes: Theme[] = [BASE_THEME],
): Theme {
  const themeMap = new Map(themes.map((t) => [t.id, t]));

  if (page.themeId) {
    const t = themeMap.get(page.themeId);
    if (t) return t;
  }

  if (document.activeThemeId) {
    const t = themeMap.get(document.activeThemeId);
    if (t) return t;
  }

  return BASE_THEME;
}

export function resolveToken<T>(
  tokenPath: string[],
  theme: Theme,
  inline?: Record<string, unknown>,
): T | undefined {
  if (inline) {
    let current: unknown = inline;
    for (const key of tokenPath) {
      current = (current as Record<string, unknown>)?.[key];
      if (current === undefined) break;
    }
    if (current !== undefined) return current as T;
  }

  let current: unknown = theme.tokens;
  for (const key of tokenPath) {
    current = (current as Record<string, unknown>)?.[key];
    if (current === undefined) return undefined;
  }
  return current as T;
}
