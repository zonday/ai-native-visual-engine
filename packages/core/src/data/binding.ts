import type {
  DataBinding,
  DataSourceRegistry,
  ResolvedBinding,
} from "./types.js";
import { BindingError } from "./types.js";

type BindingTransformer = (value: unknown) => unknown;

const transformers = new Map<string, BindingTransformer>();

export function registerTransformer(
  name: string,
  fn: BindingTransformer,
): void {
  transformers.set(name, fn);
}

export function clearTransformers(): void {
  transformers.clear();
}

type DatasetRow = Record<string, unknown>;

function resolveSourcePath(
  registry: DataSourceRegistry,
  source: string,
): unknown {
  const parts = source.split(".");
  const rootId = parts[0];
  if (!rootId) {
    throw new BindingError(
      "binding.invalid-source",
      `Invalid binding source: "${source}" — empty path`,
      source,
    );
  }

  const dataset: { id: string; rows: DatasetRow[] } | undefined =
    registry.getDataset(rootId);
  if (!dataset) {
    const variable = registry.getVariable(rootId);
    if (variable) {
      return variable.currentValue;
    }
    throw new BindingError(
      "binding.source-not-found",
      `Source "${rootId}" not found in registry`,
      source,
    );
  }

  if (parts.length === 1) {
    return dataset.rows;
  }

  const rowIndexStr = parts[1];
  if (!rowIndexStr) {
    throw new BindingError(
      "binding.invalid-path",
      `Invalid binding path: "${source}"`,
      source,
    );
  }

  const rowIndex = Number(rowIndexStr);
  if (
    !Number.isFinite(rowIndex) ||
    rowIndex < 0 ||
    !Number.isInteger(rowIndex)
  ) {
    throw new BindingError(
      "binding.invalid-row-index",
      `Invalid row index "${rowIndexStr}" in binding source "${source}"`,
      source,
    );
  }
  const row = dataset.rows[rowIndex];
  if (!row) {
    throw new BindingError(
      "binding.row-not-found",
      `Row index ${rowIndex} not found in dataset "${rootId}"`,
      source,
    );
  }

  if (parts.length > 3) {
    throw new BindingError(
      "binding.invalid-path",
      `Invalid binding path: "${source}" — path too deep (max depth: dataset.row.column)`,
      source,
    );
  }

  if (parts.length === 2) {
    return row;
  }

  const columnPart = parts[2];
  if (!columnPart) {
    throw new BindingError(
      "binding.invalid-path",
      `Invalid binding path: "${source}"`,
      source,
    );
  }

  if (columnPart in row) {
    return row[columnPart];
  }

  throw new BindingError(
    "binding.column-not-found",
    `Column "${columnPart}" not found in dataset "${rootId}"`,
    source,
  );
}

export function resolveBinding(
  binding: DataBinding,
  registry: DataSourceRegistry,
): ResolvedBinding {
  try {
    const rawValue = resolveSourcePath(registry, binding.source);
    let value = rawValue;
    if (binding.transform) {
      const transformer = transformers.get(binding.transform);
      if (transformer) {
        value = transformer(rawValue);
      }
    }
    return { key: binding.key, value, source: binding.source };
  } catch (err) {
    if (err instanceof BindingError) {
      throw err;
    }
    throw new BindingError(
      "binding.resolve-failed",
      `Failed to resolve binding "${binding.key}": ${err instanceof Error ? err.message : String(err)}`,
      binding.key,
    );
  }
}

export function resolveBindings(
  bindings: DataBinding[],
  registry: DataSourceRegistry,
): ResolvedBinding[] {
  const errors: BindingError[] = [];
  const resolved: ResolvedBinding[] = [];

  for (const binding of bindings) {
    try {
      resolved.push(resolveBinding(binding, registry));
    } catch (err) {
      if (err instanceof BindingError) {
        errors.push(err);
      } else {
        errors.push(
          new BindingError(
            "binding.resolve-failed",
            `Failed to resolve binding "${binding.key}": ${err instanceof Error ? err.message : String(err)}`,
            binding.key,
          ),
        );
      }
    }
  }

  if (errors.length > 0) {
    throw new AggregateError(
      errors,
      `Failed to resolve ${errors.length} binding(s)`,
    );
  }

  return resolved;
}

export function reResolveOnSourceChange(
  previousBindings: DataBinding[],
  previousResolved: ResolvedBinding[],
  registry: DataSourceRegistry,
): ResolvedBinding[] | null {
  if (previousBindings.length !== previousResolved.length) {
    return resolveBindings(previousBindings, registry);
  }

  let changed = false;
  for (let i = 0; i < previousBindings.length; i++) {
    const binding = previousBindings[i];
    const previous = previousResolved[i];
    if (!binding || !previous) {
      return resolveBindings(previousBindings, registry);
    }

    try {
      const current = resolveSourcePath(registry, binding.source);
      if (JSON.stringify(current) !== JSON.stringify(previous.value)) {
        changed = true;
      }
    } catch {
      return resolveBindings(previousBindings, registry);
    }
  }

  if (!changed) {
    return null;
  }

  return resolveBindings(previousBindings, registry);
}

const watcherMap = new WeakMap<ResolvedBinding, () => void>();

export function cleanupBindings(resolved: ResolvedBinding[]): void {
  for (const resolvedBinding of resolved) {
    const watcher = watcherMap.get(resolvedBinding);
    if (watcher) {
      watcher();
      watcherMap.delete(resolvedBinding);
    }
  }
}

export function watchBinding(
  resolved: ResolvedBinding,
  onDispose: () => void,
): void {
  watcherMap.set(resolved, onDispose);
}
