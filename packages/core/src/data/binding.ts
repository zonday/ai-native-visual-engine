import type { Binding } from "../types.js";
import type {
  DataSourceRegistry,
  ResolvedBinding,
  Unsubscribe,
} from "./types.js";

const sourceSubscriptions = new WeakMap<ResolvedBinding, Unsubscribe>();

export async function resolveBinding(
  binding: Binding,
  registry: DataSourceRegistry,
): Promise<ResolvedBinding> {
  const resolvedAt = Date.now();
  try {
    const sourceId = binding.source;
    if (sourceId.startsWith("dataset:")) {
      const dataset = await registry.getDataset(
        sourceId.slice("dataset:".length),
      );
      if (!dataset) {
        return {
          binding,
          value: undefined,
          resolvedAt,
          status: "error",
          error: `Dataset "${sourceId}" not found`,
        };
      }
    } else if (sourceId.startsWith("variable:")) {
      const variable = await registry.getVariable(
        sourceId.slice("variable:".length),
      );
      if (variable === undefined) {
        return {
          binding,
          value: undefined,
          resolvedAt,
          status: "error",
          error: `Variable "${sourceId}" not found`,
        };
      }
    } else {
      return {
        binding,
        value: undefined,
        resolvedAt,
        status: "error",
        error: `Unknown source format: "${sourceId}"`,
      };
    }
    const raw = await registry.resolveValue(binding.source, binding.path);
    let value = raw;
    if (binding.transform && raw !== undefined) {
      value = applyTransform(binding.transform, raw);
    }
    return {
      binding,
      value,
      resolvedAt,
      status: "ok",
      error: undefined,
    };
  } catch (err) {
    return {
      binding,
      value: undefined,
      resolvedAt,
      status: "error",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function resolveBindings(
  bindings: Binding[],
  registry: DataSourceRegistry,
): Promise<ResolvedBinding[]> {
  const results: ResolvedBinding[] = [];
  for (const binding of bindings) {
    results.push(await resolveBinding(binding, registry));
  }
  return results;
}

export async function reResolveOnSourceChange(
  previous: ResolvedBinding[],
  registry: DataSourceRegistry,
): Promise<ResolvedBinding[]> {
  const results: ResolvedBinding[] = [];
  for (const resolved of previous) {
    results.push(await resolveBinding(resolved.binding, registry));
  }
  return results;
}

export function subscribeBinding(
  resolved: ResolvedBinding,
  registry: DataSourceRegistry,
  onChange: (updated: ResolvedBinding) => void,
): void {
  const unsubscribe = registry.subscribe(
    resolved.binding.source,
    resolved.binding.path,
    async () => {
      const updated = await resolveBinding(resolved.binding, registry);
      onChange(updated);
    },
  );
  sourceSubscriptions.set(resolved, unsubscribe);
}

export function cleanupBindings(resolved: ResolvedBinding[]): void {
  for (const r of resolved) {
    const unsubscribe = sourceSubscriptions.get(r);
    if (unsubscribe) {
      unsubscribe();
      sourceSubscriptions.delete(r);
    }
  }
}

const transforms: Record<string, (value: unknown) => unknown> = {};

export function registerTransformer(
  name: string,
  fn: (value: unknown) => unknown,
): void {
  transforms[name] = fn;
}

export function clearTransformers(): void {
  for (const key of Object.keys(transforms)) {
    delete transforms[key];
  }
}

function applyTransform(name: string, value: unknown): unknown {
  const fn = transforms[name];
  return fn ? fn(value) : value;
}
