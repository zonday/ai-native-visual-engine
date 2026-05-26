import { z } from "zod/v4";

export type DataSourceId = string;
export type DatasetId = string;

export const DataColumnSchema = z.object({
  key: z.string().min(1),
  type: z.enum(["string", "number", "boolean", "date"]),
});

export type DataColumn = z.infer<typeof DataColumnSchema>;

export const DatasetSchema = z.object({
  columns: z.array(DataColumnSchema),
});

export type DatasetSchema = z.infer<typeof DatasetSchema>;

export const DatasetEntrySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  schema: DatasetSchema,
  rows: z.array(z.record(z.string(), z.unknown())),
});

export type Dataset = z.infer<typeof DatasetEntrySchema>;

export const BindingSchema = z.object({
  key: z.string().min(1),
  source: z.string().min(1),
  path: z.string().optional(),
  transform: z.string().optional(),
});

export type Binding = z.infer<typeof BindingSchema>;

export interface FilterParam {
  key: string;
  value: unknown;
  operator:
    | "eq"
    | "neq"
    | "in"
    | "gt"
    | "gte"
    | "lt"
    | "lte"
    | "between"
    | "like";
}

export interface InteractiveBinding extends Binding {
  filterParams?: Record<string, unknown>;
}

export interface ResolvedBinding {
  binding: Binding;
  value: unknown;
  resolvedAt: number;
  status: "ok" | "error" | "pending";
  error?: string;
}

export type BindingCallback = (value: unknown) => void;
export type Unsubscribe = () => void;

export interface DataSourceRegistry {
  getDataset(id: string): Promise<Dataset | undefined>;
  getVariable(id: string): Promise<unknown | undefined>;
  resolveValue(source: string, path?: string): Promise<unknown>;
  subscribe(
    source: string,
    path: string | undefined,
    callback: BindingCallback,
  ): Unsubscribe;
}

export class InMemoryDataSourceRegistry implements DataSourceRegistry {
  private datasets = new Map<string, Dataset>();
  private variables = new Map<string, unknown>();
  private subscribers = new Map<string, Set<BindingCallback>>();

  registerDataset(dataset: Dataset): void {
    this.datasets.set(dataset.id, dataset);
  }

  registerVariable(id: string, value: unknown): void {
    this.variables.set(id, value);
    this.notify(`variable:${id}`, value);
  }

  async getDataset(id: string): Promise<Dataset | undefined> {
    return this.datasets.get(id);
  }

  async getVariable(id: string): Promise<unknown | undefined> {
    return this.variables.get(id);
  }

  async resolveValue(source: string, path?: string): Promise<unknown> {
    if (source.startsWith("dataset:")) {
      const datasetId = source.slice("dataset:".length);
      const dataset = this.datasets.get(datasetId);
      if (!dataset) return undefined;
      if (!path) return dataset.rows;
      return this.traversePath(dataset.rows, path);
    }
    if (source.startsWith("variable:")) {
      const varId = source.slice("variable:".length);
      return this.variables.get(varId);
    }
    return undefined;
  }

  subscribe(
    source: string,
    _path: string | undefined,
    callback: BindingCallback,
  ): Unsubscribe {
    const key = `${source}:${_path ?? ""}`;
    let subs = this.subscribers.get(key);
    if (!subs) {
      subs = new Set();
      this.subscribers.set(key, subs);
    }
    subs.add(callback);
    return () => {
      subs?.delete(callback);
      if (subs && subs.size === 0) {
        this.subscribers.delete(key);
      }
    };
  }

  private notify(source: string, value: unknown): void {
    for (const [key, subs] of this.subscribers) {
      if (key.startsWith(source)) {
        for (const cb of subs) {
          cb(value);
        }
      }
    }
  }

  updateDatasetValue(
    datasetId: string,
    rowIndex: number,
    column: string,
    value: unknown,
  ): void {
    const dataset = this.datasets.get(datasetId);
    if (!dataset || !dataset.rows[rowIndex]) return;
    dataset.rows[rowIndex]![column] = value;
    this.notify(`dataset:${datasetId}`, dataset.rows);
  }

  private traversePath(data: unknown, path: string): unknown {
    const segments = path.split(".");
    let current: unknown = data;
    for (const segment of segments) {
      if (current === null || current === undefined) return undefined;
      if (
        typeof current === "object" &&
        segment in (current as Record<string, unknown>)
      ) {
        current = (current as Record<string, unknown>)[segment];
      } else if (Array.isArray(current)) {
        const idx = Number(segment);
        if (!Number.isFinite(idx) || idx < 0) return undefined;
        current = current[idx];
      } else {
        return undefined;
      }
    }
    return current;
  }
}
