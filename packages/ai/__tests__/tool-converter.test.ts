import { describe, it, expect, beforeEach } from "vitest";
import { createToolRegistry, type ToolRegistry } from "../src/tool-registry.js";
import {
  convertModelResponse,
  processModelResponse,
  type ModelToolCall,
} from "../src/action-converter.js";

describe("ToolRegistry", () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = createToolRegistry();
  });

  it("generates tool definitions for all semantic action types", () => {
    const defs = registry.getDefinitions();
    expect(defs.length).toBeGreaterThanOrEqual(4);

    for (const def of defs) {
      expect(def.type).toBe("function");
      expect(def.function.name).toBeTruthy();
      expect(def.function.parameters.type).toBe("object");
      expect(def.function.parameters.properties).toBeDefined();
    }
  });

  it("maps tool names to action types", () => {
    expect(registry.getActionType("create-dashboard")).toBe("create-dashboard");
    expect(registry.getActionType("insert-chart")).toBe("insert-chart");
    expect(registry.getActionType("auto-layout")).toBe("auto-layout");
    expect(registry.getActionType("update-theme-intent")).toBe("update-theme-intent");
    expect(registry.getActionType("nonexistent")).toBeUndefined();
  });

  it("create-dashboard tool has required title and optional fields", () => {
    const defs = registry.getDefinitions();
    const dashboardDef = defs.find(
      (d) => d.function.name === "create-dashboard",
    );
    expect(dashboardDef).toBeDefined();
    const params = dashboardDef!.function.parameters;
    const required = params.required as string[];
    expect(required).toContain("title");
    expect(params.properties).toHaveProperty("layout");
    expect(params.properties).toHaveProperty("widgets");
  });
});

describe("convertModelResponse", () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = createToolRegistry();
  });

  it("converts valid create-dashboard model output", () => {
    const call: ModelToolCall = {
      id: "call-1",
      type: "function",
      function: {
        name: "create-dashboard",
        arguments: JSON.stringify({
          title: "Sales Dashboard",
          layout: "compact",
          widgets: [
            { type: "metric-value", title: "Revenue", w: 4, h: 3 },
          ],
        }),
      },
    };

    const result = convertModelResponse(call, registry);
    expect(result.ok).toBe(true);
    expect(result.action?.type).toBe("create-dashboard");
    if (result.action) {
      const a = result.action as { title: string };
      expect(a.title).toBe("Sales Dashboard");
    }
  });

  it("rejects unknown tool name", () => {
    const call: ModelToolCall = {
      id: "call-2",
      type: "function",
      function: {
        name: "delete-everything",
        arguments: "{}",
      },
    };

    const result = convertModelResponse(call, registry);
    expect(result.ok).toBe(false);
    expect(result.diagnostics[0]).toContain("Unknown tool");
  });

  it("rejects invalid JSON arguments", () => {
    const call: ModelToolCall = {
      id: "call-3",
      type: "function",
      function: {
        name: "create-dashboard",
        arguments: "not valid json",
      },
    };

    const result = convertModelResponse(call, registry);
    expect(result.ok).toBe(false);
    expect(result.diagnostics[0]).toContain("Invalid JSON");
  });

  it("rejects missing required fields with diagnostics", () => {
    const call: ModelToolCall = {
      id: "call-4",
      type: "function",
      function: {
        name: "create-dashboard",
        arguments: JSON.stringify({
          layout: "balanced",
        }),
      },
    };

    const result = convertModelResponse(call, registry);
    expect(result.ok).toBe(false);
    expect(result.diagnostics.some((d) => d.includes("invalid"))).toBe(true);
  });

  it("processes multiple tool calls", () => {
    const calls: ModelToolCall[] = [
      {
        id: "call-1",
        type: "function",
        function: {
          name: "create-dashboard",
          arguments: JSON.stringify({ title: "Dashboard" }),
        },
      },
      {
        id: "call-2",
        type: "function",
        function: {
          name: "nonexistent",
          arguments: "{}",
        },
      },
    ];

    const results = processModelResponse(calls, registry);
    expect(results).toHaveLength(2);
    expect(results[0]?.ok).toBe(true);
    expect(results[1]?.ok).toBe(false);
  });
});