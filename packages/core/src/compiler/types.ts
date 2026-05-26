import type { DocumentAction } from "../document/actions.js";
import type { RuntimeAction } from "../runtime/actions.js";

export type LayoutStrategy = "compact" | "balanced" | "presentation";

export type CreateDashboardAction = {
  type: "create-dashboard";
  title: string;
  layout?: LayoutStrategy;
  widgets?: DashboardWidgetIntent[];
};

export type InsertChartAction = {
  type: "insert-chart";
  containerId: string;
  chartType: string;
  dataSource?: string;
  dimensions?: string[];
  metrics?: string[];
};

export type AutoLayoutAction = {
  type: "auto-layout";
  pageId: string;
  strategy: LayoutStrategy;
};

export type UpdateThemeIntentAction = {
  type: "update-theme-intent";
  themeId?: string;
  pageId?: string;
};

export type SemanticAction =
  | CreateDashboardAction
  | InsertChartAction
  | AutoLayoutAction
  | UpdateThemeIntentAction;

export type DashboardWidgetIntent = {
  type: string;
  title?: string;
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
