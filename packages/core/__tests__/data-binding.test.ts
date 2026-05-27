import { describe, it, expect, beforeEach } from "vitest";
import {
  InMemoryDataSourceRegistry,
  type Dataset,
  type ResolvedBinding,
} from "../src/data/types.js";
import type { DataSourceRegistry } from "../src/data/types.js";
import {
  resolveBindings,
  resolveBinding,
  reResolveOnSourceChange,
  cleanupBindings,
  subscribeBinding,
  clearTransformers,
  registerTransformer,
} from "../src/data/binding.js";

function makeDataset(overrides?: Partial<Dataset>): Dataset {
  return {
    id: "sales",
    name: "Sales Data",
    schema: {
      columns: [
        { key: "product", type: "string" },
        { key: "revenue", type: "number" },
      ],
    },
    rows: [
      { product: "Widget", revenue: 100 },
      { product: "Gadget", revenue: 200 },
    ],
    ...overrides,
  };
}

describe("InMemoryDataSourceRegistry", () => {
  let registry: InMemoryDataSourceRegistry;

  beforeEach(() => {
    registry = new InMemoryDataSourceRegistry();
  });

  it("stores and retrieves a dataset by id", async () => {
    const ds = makeDataset();
    registry.registerDataset(ds);
    const result = await registry.getDataset("sales");
    expect(result).toBe(ds);
  });

  it("returns undefined for unknown dataset id", async () => {
    const result = await registry.getDataset("missing");
    expect(result).toBeUndefined();
  });

  it("stores and retrieves a variable", async () => {
    registry.registerVariable("company", "Acme Inc");
    const result = await registry.getVariable("company");
    expect(result).toBe("Acme Inc");
  });

  it("returns undefined for unknown variable", async () => {
    const result = await registry.getVariable("missing");
    expect(result).toBeUndefined();
  });

  it("resolves a dataset source to all rows", async () => {
    registry.registerDataset(makeDataset());
    const result = await registry.resolveValue("dataset:sales");
    expect(result).toEqual(makeDataset().rows);
  });

  it("resolves a variable source", async () => {
    registry.registerVariable("title", "Dashboard");
    const result = await registry.resolveValue("variable:title");
    expect(result).toBe("Dashboard");
  });

  it("resolves a dataset with path traversal", async () => {
    registry.registerDataset(makeDataset());
    const result = await registry.resolveValue(
      "dataset:sales",
      "0.product",
    );
    expect(result).toBe("Widget");
  });

  it("returns undefined for unknown source prefix", async () => {
    const result = await registry.resolveValue("unknown:id");
    expect(result).toBeUndefined();
  });

  it("subscribes to dataset changes and receives callback", async () => {
    registry.registerDataset(makeDataset());
    let notified = false;
    const unsub = registry.subscribe(
      "dataset:sales",
      undefined,
      () => {
        notified = true;
      },
    );
    registry.updateDatasetValue("sales", 0, "revenue", 999);
    expect(notified).toBe(true);
    unsub();
  });

  it("unsubscribe stops receiving callbacks", async () => {
    registry.registerDataset(makeDataset());
    let count = 0;
    const unsub = registry.subscribe(
      "dataset:sales",
      undefined,
      () => {
        count++;
      },
    );
    unsub();
    registry.updateDatasetValue("sales", 0, "revenue", 999);
    expect(count).toBe(0);
  });

  it("traverses array paths in dataset", async () => {
    registry.registerDataset(makeDataset());
    const result = await registry.resolveValue("dataset:sales", "1.revenue");
    expect(result).toBe(200);
  });

  it("returns undefined for invalid path segment", async () => {
    registry.registerDataset(makeDataset());
    const result = await registry.resolveValue("dataset:sales", "999.product");
    expect(result).toBeUndefined();
  });
});

describe("resolveBinding", () => {
  let registry: DataSourceRegistry;

  beforeEach(() => {
    registry = new InMemoryDataSourceRegistry();
  });

  it("resolves a dataset binding with path", async () => {
    (registry as InMemoryDataSourceRegistry).registerDataset(makeDataset());
    const result = await resolveBinding(
      { key: "data", source: "dataset:sales", path: "0.product" },
      registry,
    );
    expect(result.status).toBe("ok");
    expect(result.value).toBe("Widget");
    expect(result.binding.key).toBe("data");
  });

  it("resolves a variable binding", async () => {
    (registry as InMemoryDataSourceRegistry).registerVariable(
      "title",
      "Dashboard",
    );
    const result = await resolveBinding(
      { key: "title", source: "variable:title" },
      registry,
    );
    expect(result.status).toBe("ok");
    expect(result.value).toBe("Dashboard");
  });

  it("returns error status when source is not found", async () => {
    const result = await resolveBinding(
      { key: "missing", source: "dataset:nonexistent" },
      registry,
    );
    expect(result.status).toBe("error");
    expect(result.error).toBeDefined();
  });

  it("applies a registered transform", async () => {
    clearTransformers();
    registerTransformer("double", (v) => (v as number) * 2);
    (registry as InMemoryDataSourceRegistry).registerVariable("num", 21);
    const result = await resolveBinding(
      { key: "t", source: "variable:num", transform: "double" },
      registry,
    );
    expect(result.status).toBe("ok");
    expect(result.value).toBe(42);
  });

  it("ignores unregistered transform and returns raw value", async () => {
    clearTransformers();
    (registry as InMemoryDataSourceRegistry).registerVariable("num", 42);
    const result = await resolveBinding(
      { key: "t", source: "variable:num", transform: "nonexistent" },
      registry,
    );
    expect(result.status).toBe("ok");
    expect(result.value).toBe(42);
  });
});

describe("resolveBindings", () => {
  it("resolves multiple bindings at once", async () => {
    const registry = new InMemoryDataSourceRegistry();
    registry.registerDataset(makeDataset());
    registry.registerVariable("title", "Dashboard");

    const results = await resolveBindings(
      [
        { key: "rev", source: "dataset:sales", path: "0.revenue" },
        { key: "title", source: "variable:title" },
      ],
      registry,
    );
    expect(results).toHaveLength(2);
    expect(results[0]?.value).toBe(100);
    expect(results[1]?.value).toBe("Dashboard");
  });

  it("resolves failed bindings with error status", async () => {
    const registry = new InMemoryDataSourceRegistry();
    const results = await resolveBindings(
      [{ key: "fail", source: "dataset:nope" }],
      registry,
    );
    expect(results).toHaveLength(1);
    expect(results[0]?.status).toBe("error");
  });
});

describe("subscribeBinding and cleanupBindings", () => {
  it("subscribes to source changes and fires callback", async () => {
    const registry = new InMemoryDataSourceRegistry();
    registry.registerDataset(makeDataset());

    const resolved = await resolveBinding(
      { key: "data", source: "dataset:sales", path: "0.product" },
      registry,
    );

    let updated: ResolvedBinding | undefined;
    subscribeBinding(resolved, registry, (newVal) => {
      updated = newVal;
    });

    registry.updateDatasetValue("sales", 0, "product", "UpdatedWidget");

    await new Promise((r) => setTimeout(r, 10));
    const latest = updated;
    expect(latest).toBeDefined();
    if (!latest) throw new Error("Expected binding subscription update");
    expect(latest.value).toBe("UpdatedWidget");
  });

  it("cleanupBindings removes subscriptions", async () => {
    const registry = new InMemoryDataSourceRegistry();
    registry.registerDataset(makeDataset());

    const resolved = await resolveBinding(
      { key: "data", source: "dataset:sales", path: "0.product" },
      registry,
    );

    let callCount = 0;
    subscribeBinding(resolved, registry, () => {
      callCount++;
    });

    registry.updateDatasetValue("sales", 0, "product", "Changed");
    await new Promise((r) => setTimeout(r, 10));

    cleanupBindings([resolved]);

    registry.updateDatasetValue("sales", 0, "product", "ChangedAgain");
    await new Promise((r) => setTimeout(r, 10));

    expect(callCount).toBe(1);
  });
});

describe("reResolveOnSourceChange", () => {
  it("returns updated values when source has changed", async () => {
    const registry = new InMemoryDataSourceRegistry();
    registry.registerDataset(makeDataset());

    const previous = await resolveBindings(
      [{ key: "rev", source: "dataset:sales", path: "0.revenue" }],
      registry,
    );

    registry.updateDatasetValue("sales", 0, "revenue", 999);

    const updated = await reResolveOnSourceChange(previous, registry);
    expect(updated[0]?.value).toBe(999);
  });
});
