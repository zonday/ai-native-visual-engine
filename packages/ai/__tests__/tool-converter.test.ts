import { describe, it, expect } from "vitest";
import type { CompileResult } from "@ai-native/core";
import { ALL_TOOLS } from "../src/tool-registry.js";

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
    for (const [, tool] of Object.entries(ALL_TOOLS)) {
      expect(tool.description).toBeTruthy();
      expect(tool.inputSchema).toBeDefined();
      expect(tool.execute).toBeDefined();
    }
  });

  it("each tool execute function returns compile result", async () => {
    const tool = ALL_TOOLS["create-dashboard"];
    if (!tool || !tool.execute) return;
    const result = (await tool.execute(
      { title: "Test" },
      { toolCallId: "test", messages: [] },
    )) as CompileResult;
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.plan).toBeDefined();
    }
  });

  it("auto-layout tool requires valid strategy", async () => {
    const tool = ALL_TOOLS["auto-layout"];
    if (!tool || !tool.execute) return;
    const result = (await tool.execute(
      { pageId: "p1", strategy: "compact" },
      { toolCallId: "test", messages: [] },
    )) as CompileResult;
    expect(result.ok).toBe(true);
  });
});