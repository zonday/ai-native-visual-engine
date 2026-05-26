import { describe, it, expect, beforeEach } from "vitest";
import {
  DataSourceRegistry,
  BindingError,
  type DataBinding,
  type DataSource,
  type Dataset,
  type DataRegistryVariable,
} from "../src/data/types.js";
import {
  resolveBindings,
  resolveBinding,
  reResolveOnSourceChange,
  cleanupBindings,
  watchBinding,
  clearTransformers,
  registerTransformer,
} from "../src/data/binding.js";

function makeSource(overrides?: Partial<DataSource>): DataSource {
  return {
    id: "source-1",
    type: "csv",
    config: { url: "file.csv" },
    ...overrides,
  };
}

function makeDataset(overrides?: Partial<Dataset>): Dataset {
  return {
    id: "dataset-1",
    name: "Sales Data",
    sourceId: "source-1",
    columns: [
      { name: "product", type: "string" },
      { name: "revenue", type: "number" },
    ],
    rows: [
      { product: "Widget", revenue: 100 },
      { product: "Gadget", revenue: 200 },
    ],
    ...overrides,
  };
}

function makeVariable(overrides?: Partial<DataRegistryVariable>): DataRegistryVariable {
  return {
    id: "var-1",
    name: "Threshold",
    defaultValue: 50,
    currentValue: 50,
    ...overrides,
  };
}

describe("DataSourceRegistry", () => {
  let registry: DataSourceRegistry;

  beforeEach(() => {
    registry = new DataSourceRegistry();
  });

  describe("sources", () => {
    it("stores and retrieves a data source by id", () => {
      const source = makeSource();
      registry.registerSource(source);
      expect(registry.getSource("source-1")).toBe(source);
      expect(registry.hasSource("source-1")).toBe(true);
    });

    it("returns undefined for unknown source id", () => {
      expect(registry.getSource("missing")).toBeUndefined();
      expect(registry.hasSource("missing")).toBe(false);
    });

    it("unregisters a source and returns true when it existed", () => {
      registry.registerSource(makeSource());
      expect(registry.unregisterSource("source-1")).toBe(true);
      expect(registry.hasSource("source-1")).toBe(false);
    });

    it("returns false when unregistering a missing source", () => {
      expect(registry.unregisterSource("missing")).toBe(false);
    });

    it("lists all registered sources", () => {
      const a = makeSource({ id: "a" });
      const b = makeSource({ id: "b" });
      registry.registerSource(a);
      registry.registerSource(b);
      expect(registry.listSources()).toEqual([a, b]);
    });
  });

  describe("datasets", () => {
    it("stores and retrieves a dataset by id", () => {
      const ds = makeDataset();
      registry.registerDataset(ds);
      expect(registry.getDataset("dataset-1")).toBe(ds);
    });

    it("unregisters a dataset", () => {
      registry.registerDataset(makeDataset());
      expect(registry.unregisterDataset("dataset-1")).toBe(true);
      expect(registry.getDataset("dataset-1")).toBeUndefined();
    });

    it("lists all datasets", () => {
      const a = makeDataset({ id: "a" });
      const b = makeDataset({ id: "b" });
      registry.registerDataset(a);
      registry.registerDataset(b);
      expect(registry.listDatasets()).toEqual([a, b]);
    });
  });

  describe("variables", () => {
    it("stores and retrieves a variable by id", () => {
      const v = makeVariable();
      registry.registerVariable(v);
      expect(registry.getVariable("var-1")).toBe(v);
    });

    it("unregisters a variable", () => {
      registry.registerVariable(makeVariable());
      expect(registry.unregisterVariable("var-1")).toBe(true);
      expect(registry.getVariable("var-1")).toBeUndefined();
    });

    it("lists all variables", () => {
      const a = makeVariable({ id: "a" });
      const b = makeVariable({ id: "b" });
      registry.registerVariable(a);
      registry.registerVariable(b);
      expect(registry.listVariables()).toEqual([a, b]);
    });
  });

  describe("clear", () => {
    it("removes all sources, datasets, and variables", () => {
      registry.registerSource(makeSource());
      registry.registerDataset(makeDataset());
      registry.registerVariable(makeVariable());
      registry.clear();
      expect(registry.listSources()).toHaveLength(0);
      expect(registry.listDatasets()).toHaveLength(0);
      expect(registry.listVariables()).toHaveLength(0);
    });
  });
});

describe("resolveBinding", () => {
  let registry: DataSourceRegistry;

  beforeEach(() => {
    registry = new DataSourceRegistry();
  });

  it("resolves a dataset binding to all rows", () => {
    registry.registerDataset(makeDataset());
    const result = resolveBinding(
      { key: "data", source: "dataset-1" },
      registry,
    );
    expect(result.key).toBe("data");
    expect(result.value).toEqual(makeDataset().rows);
  });

  it("resolves a specific row by index", () => {
    registry.registerDataset(makeDataset());
    const result = resolveBinding(
      { key: "first", source: "dataset-1.0" },
      registry,
    );
    expect(result.value).toEqual({ product: "Widget", revenue: 100 });
  });

  it("resolves a specific column from a row", () => {
    registry.registerDataset(makeDataset());
    const result = resolveBinding(
      { key: "revenue", source: "dataset-1.0.revenue" },
      registry,
    );
    expect(result.value).toBe(100);
  });

  it("resolves using separate path field", () => {
    registry.registerDataset(makeDataset());
    const result = resolveBinding(
      { key: "revenue", source: "dataset-1", path: "0.revenue" },
      registry,
    );
    expect(result.value).toBe(100);
  });

  it("resolves a variable value", () => {
    registry.registerVariable(makeVariable());
    const result = resolveBinding(
      { key: "threshold", source: "var-1" },
      registry,
    );
    expect(result.value).toBe(50);
  });

  it("throws BindingError when source is not found", () => {
    expect(() =>
      resolveBinding({ key: "x", source: "missing" }, registry),
    ).toThrow(BindingError);
  });

  it("throws BindingError when row index is out of bounds", () => {
    registry.registerDataset(makeDataset());
    expect(() =>
      resolveBinding({ key: "x", source: "dataset-1.99" }, registry),
    ).toThrow(BindingError);
  });

  it("throws BindingError when column is not found", () => {
    registry.registerDataset(makeDataset());
    expect(() =>
      resolveBinding({ key: "x", source: "dataset-1.0.missing" }, registry),
    ).toThrow(BindingError);
  });

  it("throws BindingError for invalid row index (non-numeric)", () => {
    registry.registerDataset(makeDataset());
    expect(() =>
      resolveBinding({ key: "x", source: "dataset-1.abc" }, registry),
    ).toThrow(/Invalid row index/);
  });

  it("throws BindingError for row index with decimal", () => {
    registry.registerDataset(makeDataset());
    expect(() =>
      resolveBinding({ key: "x", source: "dataset-1.1point5.revenue" }, registry),
    ).toThrow(/Invalid row index/);
  });

  it("throws BindingError for deeply nested path", () => {
    registry.registerDataset(makeDataset());
    expect(() =>
      resolveBinding({ key: "x", source: "dataset-1.0.revenue.extra" }, registry),
    ).toThrow(/path too deep/);
  });

  it("applies a registered transform", () => {
    clearTransformers();
    registerTransformer("double", (v) => (v as number) * 2);
    registry.registerVariable(makeVariable());
    const result = resolveBinding(
      { key: "t", source: "var-1", transform: "double" },
      registry,
    );
    expect(result.value).toBe(100);
  });

  it("returns raw value when transform is not registered", () => {
    clearTransformers();
    registry.registerVariable(makeVariable());
    const result = resolveBinding(
      { key: "t", source: "var-1", transform: "nonexistent" },
      registry,
    );
    expect(result.value).toBe(50);
  });
});

describe("resolveBindings", () => {
  it("resolves multiple bindings at once", () => {
    const registry = new DataSourceRegistry();
    registry.registerDataset(makeDataset());
    registry.registerVariable(makeVariable());

    const resolved = resolveBindings(
      [
        { key: "revenue", source: "dataset-1.0.revenue" },
        { key: "threshold", source: "var-1" },
      ],
      registry,
    );
    expect(resolved).toHaveLength(2);
    expect(resolved[0]?.value).toBe(100);
    expect(resolved[1]?.value).toBe(50);
  });

  it("throws AggregateError when any binding fails", () => {
    const registry = new DataSourceRegistry();
    registry.registerDataset(makeDataset());

    expect(() =>
      resolveBindings(
        [
          { key: "ok", source: "dataset-1.0.product" },
          { key: "fail", source: "missing" },
        ],
        registry,
      ),
    ).toThrow(AggregateError);
  });
});

describe("reResolveOnSourceChange", () => {
  it("returns null when source values have not changed", () => {
    const registry = new DataSourceRegistry();
    registry.registerVariable(makeVariable());

    const bindings: DataBinding[] = [{ key: "v", source: "var-1" }];
    const resolved = resolveBindings(bindings, registry);
    const result = reResolveOnSourceChange(bindings, resolved, registry);
    expect(result).toBeNull();
  });

  it("returns updated values when source has changed", () => {
    const registry = new DataSourceRegistry();
    const variable = makeVariable();
    registry.registerVariable(variable);

    const bindings: DataBinding[] = [{ key: "v", source: "var-1" }];
    const resolved = resolveBindings(bindings, registry);
    variable.currentValue = 99;

    const result = reResolveOnSourceChange(bindings, resolved, registry);
    expect(result).not.toBeNull();
    if (result) {
      expect(result[0]?.value).toBe(99);
    }
  });

  it("re-resolves all bindings when counts mismatch", () => {
    const registry = new DataSourceRegistry();
    registry.registerDataset(makeDataset());

    const bindings: DataBinding[] = [
      { key: "a", source: "dataset-1.0.product" },
    ];
    const resolved = resolveBindings(bindings, registry);
    const result = reResolveOnSourceChange(bindings, resolved.slice(1), registry);
    expect(result).not.toBeNull();
    if (result) {
      expect(result).toHaveLength(1);
    }
  });
});

describe("cleanupBindings", () => {
  it("disposes watchers registered for resolved bindings", () => {
    const disposed: string[] = [];
    const registry = new DataSourceRegistry();
    registry.registerVariable(makeVariable());

    const resolved = resolveBindings(
      [{ key: "v", source: "var-1" }],
      registry,
    );
    for (const r of resolved) {
      watchBinding(r, () => disposed.push(r.key));
    }

    cleanupBindings(resolved);
    expect(disposed).toEqual(["v"]);
  });
});