import { describe, expect, it } from "vitest";
import { createNewDocument } from "../src/bootstrap.js";
import { BASE_THEME, resolveTheme, resolveToken } from "../src/theme.js";

describe("BASE_THEME", () => {
  it("has all required token categories", () => {
    expect(BASE_THEME.tokens.colors).toBeDefined();
    expect(BASE_THEME.tokens.spacing).toBeDefined();
    expect(BASE_THEME.tokens.typography).toBeDefined();
    expect(BASE_THEME.tokens.borders).toBeDefined();
    expect(BASE_THEME.tokens.shadows).toBeDefined();
  });
});

describe("resolveTheme", () => {
  it("returns BASE_THEME when no theme is set", () => {
    const doc = createNewDocument();
    const result = resolveTheme(doc.pages[0]!, doc);
    expect(result.id).toBe("base");
  });

  it("uses document.activeThemeId when set", () => {
    const doc = createNewDocument({ themeId: "dark-theme" });
    const dark: typeof BASE_THEME = {
      ...BASE_THEME,
      id: "dark-theme",
      name: "Dark",
    };
    const result = resolveTheme(doc.pages[0]!, doc, [BASE_THEME, dark]);
    expect(result.id).toBe("dark-theme");
  });

  it("page themeId overrides document themeId", () => {
    const doc = createNewDocument({ themeId: "doc-theme" });
    const page = { ...doc.pages[0]!, themeId: "page-theme" };
    const docTheme = { ...BASE_THEME, id: "doc-theme" };
    const pageTheme = { ...BASE_THEME, id: "page-theme" };
    const result = resolveTheme(page, doc, [BASE_THEME, docTheme, pageTheme]);
    expect(result.id).toBe("page-theme");
  });

  it("falls back to BASE_THEME if referenced theme is missing", () => {
    const doc = createNewDocument({ themeId: "missing" });
    const result = resolveTheme(doc.pages[0]!, doc);
    expect(result.id).toBe("base");
  });
});

describe("resolveToken", () => {
  it("resolves nested theme token", () => {
    const color = resolveToken<string>(["colors", "accent"], BASE_THEME);
    expect(color).toBe("#3b82f6");
  });

  it("returns undefined for missing token", () => {
    const result = resolveToken(["colors", "nonexistent"], BASE_THEME);
    expect(result).toBeUndefined();
  });

  it("inline style overrides theme token", () => {
    const bg = resolveToken<string>(["colors", "background"], BASE_THEME, {
      colors: { background: "#000" },
    });
    expect(bg).toBe("#000");
  });

  it("returns theme value when inline doesn't have the token", () => {
    const bg = resolveToken<string>(["colors", "background"], BASE_THEME, {
      colors: {},
    });
    expect(bg).toBe("#ffffff");
  });
});
