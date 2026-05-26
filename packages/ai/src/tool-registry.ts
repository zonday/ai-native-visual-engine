import { tool } from "ai";
import { compileSemanticAction } from "@ai-native/core";
import type { CompileResult, SemanticAction } from "@ai-native/core";
import {
  AutoLayoutActionSchema,
  CreateDashboardActionSchema,
  InsertChartActionSchema,
  UpdateThemeIntentActionSchema,
} from "@ai-native/core";
import { z } from "zod/v4";

function createTool(
  name: string,
  description: string,
  schema: z.ZodObject<z.ZodRawShape>,
) {
  return tool({
    description,
    inputSchema: schema.omit({ type: true }),
    execute: async (args): Promise<CompileResult> =>
      compileSemanticAction({ type: name, ...args } as SemanticAction),
  });
}

type AnyTool = ReturnType<typeof createTool>;

export const createDashboardTool = createTool(
  "create-dashboard",
  "Create a new dashboard page with specified title, layout strategy, and widgets.",
  CreateDashboardActionSchema,
);

export const insertChartTool = createTool(
  "insert-chart",
  "Insert a chart into an existing container. Specify container ID, chart type, data source, dimensions, and metrics.",
  InsertChartActionSchema,
);

export const autoLayoutTool = createTool(
  "auto-layout",
  "Auto-arrange elements within a page using a layout strategy: compact, balanced, or presentation.",
  AutoLayoutActionSchema,
);

export const updateThemeIntentTool = createTool(
  "update-theme-intent",
  "Update theme for a document or page. Requires at least one of themeId or pageId.",
  UpdateThemeIntentActionSchema,
);

export const ALL_TOOLS: Record<string, AnyTool> = {
  "create-dashboard": createDashboardTool,
  "insert-chart": insertChartTool,
  "auto-layout": autoLayoutTool,
  "update-theme-intent": updateThemeIntentTool,
};