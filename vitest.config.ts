import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": new URL("./packages/editor/src", import.meta.url).pathname,
      "@ai-native/ai": new URL("./packages/ai/src/index.ts", import.meta.url)
        .pathname,
      "@ai-native/core": new URL(
        "./packages/core/src/index.ts",
        import.meta.url,
      ).pathname,
      "@ai-native/editor": new URL(
        "./packages/editor/src/index.ts",
        import.meta.url,
      ).pathname,
      "@ai-native/renderer-react": new URL(
        "./packages/renderer-react/src/index.ts",
        import.meta.url,
      ).pathname,
    },
  },
  test: {
    include: ["packages/*/__tests__/**/*.{test,spec}.{ts,tsx}"],
  },
});
