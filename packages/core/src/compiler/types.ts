import { z } from "zod/v4";
import type { DocumentAction } from "../document/actions.js";
import type { RuntimeAction } from "../runtime/actions.js";

export type LayoutStrategy = "compact" | "balanced" | "presentation";

export const LayoutStrategySchema = z.enum([
  "compact",
  "balanced",
  "presentation",
]);

export type CreateDashboardAction = {
  type: "create-dashboard";
  title: string;
  layout?: LayoutStrategy;
  widgets?: DashboardWidgetIntent[];
};

export const DashboardWidgetIntentSchema = z.object({
  type: z.string().min(1),
  title: z.string().optional(),
  x: z.number().optional(),
  y: z.number().optional(),
  w: z.number().optional(),
  h: z.number().optional(),
});

export const CreateDashboardActionSchema = z.object({
  type: z.literal("create-dashboard"),
  title: z.string().min(1),
  layout: LayoutStrategySchema.optional(),
  widgets: z.array(DashboardWidgetIntentSchema).optional(),
});

export type InsertChartAction = {
  type: "insert-chart";
  containerId: string;
  chartType: string;
  dataSource?: string;
  dimensions?: string[];
  metrics?: string[];
};

export const InsertChartActionSchema = z.object({
  type: z.literal("insert-chart"),
  containerId: z.string().min(1),
  chartType: z.string().min(1),
  dataSource: z.string().optional(),
  dimensions: z.array(z.string()).optional(),
  metrics: z.array(z.string()).optional(),
});

export type AutoLayoutAction = {
  type: "auto-layout";
  pageId: string;
  strategy: LayoutStrategy;
};

export const AutoLayoutActionSchema = z.object({
  type: z.literal("auto-layout"),
  pageId: z.string().min(1),
  strategy: LayoutStrategySchema,
});

export type UpdateThemeIntentAction = {
  type: "update-theme-intent";
  themeId?: string;
  pageId?: string;
};

export const UpdateThemeIntentActionSchema = z.object({
  type: z.literal("update-theme-intent"),
  themeId: z.string().optional(),
  pageId: z.string().optional(),
});

export const SemanticActionSchema = z.discriminatedUnion("type", [
  CreateDashboardActionSchema,
  InsertChartActionSchema,
  AutoLayoutActionSchema,
  UpdateThemeIntentActionSchema,
]);

export type SemanticAction = z.infer<typeof SemanticActionSchema>;

export type DashboardWidgetIntent = {
  type: string;
  title?: string;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
};

export interface NormalizedCreateDashboardAction {
  type: "create-dashboard";
  title: string;
  layout: LayoutStrategy;
  widgets: DashboardWidgetIntent[];
}

export interface NormalizedInsertChartAction {
  type: "insert-chart";
  containerId: string;
  chartType: string;
  dataSource?: string;
  dimensions: string[];
  metrics: string[];
}

export interface NormalizedAutoLayoutAction {
  type: "auto-layout";
  pageId: string;
  strategy: LayoutStrategy;
}

export interface NormalizedUpdateThemeIntentAction {
  type: "update-theme-intent";
  themeId?: string;
  pageId?: string;
}

export type NormalizedSemanticAction =
  | NormalizedCreateDashboardAction
  | NormalizedInsertChartAction
  | NormalizedAutoLayoutAction
  | NormalizedUpdateThemeIntentAction;

export interface ExecutionPlan {
  documentActions: DocumentAction[];
  runtimeActions: RuntimeAction[];
}

export interface SemanticDiagnostic {
  code: string;
  message: string;
  severity: "error" | "warning" | "info";
  stage?: string;
}

export interface StageResult<TOutput> {
  ok: true;
  output: TOutput;
}

export interface StageError {
  ok: false;
  diagnostics: SemanticDiagnostic[];
}

export type StageOutcome<TOutput> = StageResult<TOutput> | StageError;

export interface CompilerContext {
  document?: unknown;
  scene?: unknown;
}

export interface CompilerStage<TInput, TOutput> {
  name: string;
  run(input: TInput, context: CompilerContext): StageOutcome<TOutput>;
}

export type CompileSuccess = {
  ok: true;
  plan: ExecutionPlan;
};

export type CompileFailure = {
  ok: false;
  diagnostics: SemanticDiagnostic[];
};

export type CompileResult = CompileSuccess | CompileFailure;
