import { tool } from "ai";
import type { CompileResult, SemanticAction } from "@ai-native/core";
import { compileSemanticAction } from "@ai-native/core";
import {
  CreateDashboardActionSchema,
  InsertChartActionSchema,
  AutoLayoutActionSchema,
  UpdateThemeIntentActionSchema,
} from "@ai-native/core";
import { z as zodImpl } from "zod/v4";

export { type Tool } from "ai";

function createActionTool(
  name: string,
  description: string,
  schema: zodImpl.ZodObject<Record<string, zodImpl.ZodType>>,
) {
  const inputSchema = schema.omit({ type: true }) as zodImpl.ZodObject<
    Record<string, zodImpl.ZodType>
  >;

  return tool({
    description,
    inputSchema,
    execute: async (
      args,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      _options,
    ) => {
      const action = { type: name, ...args };
      const result = compileSemanticAction(
        action as unknown as SemanticAction,
      );
      return result as unknown as CompileResult;
    },
  });
}

export const createDashboardTool = createActionTool(
  "create-dashboard",
  "Create a new dashboard page with specified title, layout strategy, and widgets. Use when the user asks to build or create a dashboard, add charts, or set up visual components.",
  CreateDashboardActionSchema,
);

export const insertChartTool = createActionTool(
  "insert-chart",
  "Insert a chart component into an existing container on a page. Specify the container ID, chart type, data source, dimensions, and metrics. Use when adding visualizations to an existing dashboard.",
  InsertChartActionSchema,
);

export const autoLayoutTool = createActionTool(
  "auto-layout",
  "Automatically arrange child elements within a page using a layout strategy. Supports compact (dense packing), balanced (equal column distribution), or presentation (centered) layouts.",
  AutoLayoutActionSchema,
);

export const updateThemeIntentTool = createActionTool(
  "update-theme-intent",
  "Update the theme for a document or specific page. Specify themeId for document-level theme changes or pageId for page-level theme overrides. At least one of themeId or pageId is required.",
  UpdateThemeIntentActionSchema,
);

export const ALL_TOOLS: Record<string, ReturnType<typeof createActionTool>> = {
  "create-dashboard": createDashboardTool,
  "insert-chart": insertChartTool,
  "auto-layout": autoLayoutTool,
  "update-theme-intent": updateThemeIntentTool,
};
