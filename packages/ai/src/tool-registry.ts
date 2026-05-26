import { tool } from "ai";
import type { CompileResult, SemanticAction } from "@ai-native/core";
import { compileSemanticAction } from "@ai-native/core";
import {
  CreateDashboardActionSchema,
  InsertChartActionSchema,
  AutoLayoutActionSchema,
  UpdateThemeIntentActionSchema,
} from "@ai-native/core";
import { z } from "zod/v4";

export { type Tool } from "ai";

function createActionTool(
  name: string,
  description: string,
  schema: z.ZodObject<z.ZodRawShape>,
) {
  const inputSchema = schema.omit({ type: true });

  return tool({
    description,
    inputSchema,
    execute: async (args, _options) => {
      const action = { type: name, ...args } as SemanticAction;
      return compileSemanticAction(action) as CompileResult;
    },
  });
}

export const createDashboardTool = createActionTool(
  "create-dashboard",
  "Create a new dashboard page with specified title, layout strategy, and widgets. Use when you need to build a dashboard, add charts, or set up visual components.",
  CreateDashboardActionSchema,
);

export const insertChartTool = createActionTool(
  "insert-chart",
  "Insert a chart component into an existing container on a page. Specify container ID, chart type, data source, dimensions, and metrics. Use when adding visualizations to an existing dashboard.",
  InsertChartActionSchema,
);

export const autoLayoutTool = createActionTool(
  "auto-layout",
  "Automatically arrange child elements within a page using a layout strategy. Supports compact, balanced, or presentation layouts.",
  AutoLayoutActionSchema,
);

export const updateThemeIntentTool = createActionTool(
  "update-theme-intent",
  "Update the theme for a document or specific page. Specify themeId for document-level changes or pageId for page-level overrides.",
  UpdateThemeIntentActionSchema,
);

export const ALL_TOOLS: Record<string, ReturnType<typeof createActionTool>> = {
  "create-dashboard": createDashboardTool,
  "insert-chart": insertChartTool,
  "auto-layout": autoLayoutTool,
  "update-theme-intent": updateThemeIntentTool,
};