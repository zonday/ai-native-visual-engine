import { describe, it, expect } from "vitest";
import { ALL_TOOLS } from "../src/tool-registry.js";
import {
  executeToolCall,
  executeAllToolCalls,
} from "../src/action-converter.js";

describe("AI SDK Tools", () => {
  it("defines tools for all four semantic action types", () => {
    const names = Object.keys(ALL_TOOLS);
    expect(names).toContain("create-dashboard");
    expect(names).toContain("insert-chart");
    expect(names).toContain("auto-layout");
    expect(names).toContain("update-theme-intent");
    expect(names).toHaveLength(4);
  });

  it("each tool has a description and inputSchema", () => {
    for (const [name, tool] of Object.entries(ALL_TOOLS)) {
      expect(tool.description).toBeTruthy();
      expect(tool.inputSchema).toBeDefined();
    }
  });

  it("create-dashboard tool has title as required field", () => {
    const tool = ALL_TOOLS["create-dashboard"];
    expect(tool).toBeDefined();
    expect(tool!.description).toContain("dashboard");
  });
});

describe("executeToolCall", () => {
  it("executes a valid create-dashboard tool call", async () => {
    const result = await executeToolCall("create-dashboard", {
      title: "Sales Dashboard",
      layout: "compact",
      widgets: [{ type: "metric-value", title: "Revenue", w: 4, h: 3 }],
    });

    expect(result.ok).toBe(true);
    expect(result.compileResult.ok).toBe(true);
  });

  it("returns diagnostics for unknown tool name", async () => {
    const result = await executeToolCall("nonexistent-tool", {});
    expect(result.ok).toBe(false);
    expect(result.diagnostics[0]).toContain("Unknown tool");
  });

  it("returns diagnostics for invalid arguments", async () => {
    const result = await executeToolCall("create-dashboard", {
      layout: "balanced",
    });

    expect(result.ok).toBe(true);
    expect(result.compileResult.ok).toBe(false);
    expect(
      result.compileResult.ok
        ? []
        : result.compileResult.diagnostics.some(
            (d: { code: string }) => d.code.includes("invalid"),
          ),
    ).toBe(true);
  });

  it("executes all valid tool calls in batch", async () => {
    const results = await executeAllToolCalls([
      { toolName: "create-dashboard", args: { title: "Dashboard" } },
      { toolName: "nonexistent", args: {} },
    ]);

    expect(results).toHaveLength(2);
    expect(results[0]?.ok).toBe(true);
    expect(results[1]?.ok).toBe(false);
  });

  it("auto-layout tool requires pageId and strategy", async () => {
    const result = await executeToolCall("auto-layout", {
      pageId: "page-1",
      strategy: "compact",
    });
    expect(result.ok).toBe(true);
    expect(result.compileResult.ok).toBe(true);
  });
});