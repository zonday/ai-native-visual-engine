import { z } from "zod/v4";

export type DataSourceId = string;
export type DatasetId = string;
export type VariableId = string;

export const DataColumnSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["string", "number", "boolean", "date"]),
});

export type DataColumn = z.infer<typeof DataColumnSchema>;

export const DataSourceSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  config: z.record(z.string(), z.unknown()).optional(),
});

export type DataSource = z.infer<typeof DataSourceSchema>;

export const DatasetSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  sourceId: z.string().min(1),
  columns: z.array(DataColumnSchema),
  rows: z.array(z.record(z.string(), z.unknown())),
});

export type Dataset = z.infer<typeof DatasetSchema>;

export const VariableSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  defaultValue: z.unknown(),
  currentValue: z.unknown(),
});

export type DataVariable = z.infer<typeof VariableSchema>;

export const BindingSchema = z.object({
  key: z.string().min(1),
  source: z.string().min(1),
  transform: z.string().optional(),
});

export type DataBinding = z.infer<typeof BindingSchema>;

export class BindingError extends Error {
  readonly code: string;
  readonly bindingKey: string;

  constructor(code: string, message: string, bindingKey: string) {
    super(message);
    this.name = "BindingError";
    this.code = code;
    this.bindingKey = bindingKey;
  }
}

export interface ResolvedBinding {
  key: string;
  value: unknown;
  source: string;
}

export class DataSourceRegistry {
  private sources = new Map<DataSourceId, DataSource>();
  private datasets = new Map<DatasetId, Dataset>();
  private variables = new Map<VariableId, DataVariable>();

  registerSource(source: DataSource): void {
    this.sources.set(source.id, source);
  }

  unregisterSource(sourceId: DataSourceId): boolean {
    return this.sources.delete(sourceId);
  }

  registerDataset(dataset: Dataset): void {
    this.datasets.set(dataset.id, dataset);
  }

  unregisterDataset(datasetId: DatasetId): boolean {
    return this.datasets.delete(datasetId);
  }

  registerVariable(variable: DataVariable): void {
    this.variables.set(variable.id, variable);
  }

  unregisterVariable(variableId: VariableId): boolean {
    return this.variables.delete(variableId);
  }

  getSource(sourceId: DataSourceId): DataSource | undefined {
    return this.sources.get(sourceId);
  }

  getDataset(datasetId: DatasetId): Dataset | undefined {
    return this.datasets.get(datasetId);
  }

  getVariable(variableId: VariableId): DataVariable | undefined {
    return this.variables.get(variableId);
  }

  hasSource(sourceId: DataSourceId): boolean {
    return this.sources.has(sourceId);
  }

  hasDataset(datasetId: DatasetId): boolean {
    return this.datasets.has(datasetId);
  }

  hasVariable(variableId: VariableId): boolean {
    return this.variables.has(variableId);
  }

  listSources(): DataSource[] {
    return [...this.sources.values()];
  }

  listDatasets(): Dataset[] {
    return [...this.datasets.values()];
  }

  listVariables(): DataVariable[] {
    return [...this.variables.values()];
  }

  clear(): void {
    this.sources.clear();
    this.datasets.clear();
    this.variables.clear();
  }
}
