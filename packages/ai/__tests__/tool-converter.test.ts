import { describe, it, expect } from "vitest";
import type { CompileResult } from "@ai-native/core";
import { ALL_TOOLS } from "../src/tool-registry.js";

async function exec<const T extends keyof typeof ALL_TOOLS>(
  toolName: T,
  args: Record<string, unknown>,
): Promise<CompileResult> {
  const tool = ALL_TOOLS[toolName];
  if (!tool?.execute) throw new Error(`Tool ${toolName} not executable`);
  return (await tool.execute(args, {
    toolCallId: "test",
    messages: [],
  })) as CompileResult;
}

describe("create-dashboard tool", () => {
  it("produces create-page + create-node actions for valid dashboard", async () => {
    const result = await exec("create-dashboard", {
      title: "Sales Board",
      widgets: [
        { type: "metric-value", title: "Revenue", w: 4, h: 3 },
        { type: "chart", title: "Trend", w: 8, h: 4 },
      ],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plan.documentActions.length).toBeGreaterThan(0);
    expect(result.plan.documentActions[0]?.type).toBe("create-page");
    expect(result.plan.runtimeActions.length).toBeGreaterThan(0);
    const creates = result.plan.runtimeActions.filter((a) => a.type === "create-node");
    expect(creates.length).toBeGreaterThan(0);
  });

  it("returns diagnostics when title is missing", async () => {
    const result = await exec("create-dashboard", {});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.diagnostics.length).toBeGreaterThan(0);
    }
  });

  it("uses balanced layout by default", async () => {
    const result = await exec("create-dashboard", {
      title: "Test",
      widgets: [{ type: "metric-value", title: "X" }],
    });
    expect(result.ok).toBe(true);
  });
});

describe("insert-chart tool", () => {
  it("rejects when containerId is missing", async () => {
    const result = await exec("insert-chart", {
      chartType: "bar",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.diagnostics.length).toBeGreaterThan(0);
    }
  });
});

describe("auto-layout tool", () => {
  it("produces update-layout actions for page children", async () => {
    const result = await exec("auto-layout", {
      pageId: "page-1",
      strategy: "compact",
    });
    expect(result.ok).toBe(true);
  });

  it("rejects invalid strategy value", async () => {
    const result = await exec("auto-layout", {
      pageId: "p1",
      strategy: "unknown-strategy",
    });
    expect(result.ok).toBe(false);
  });
});

describe("update-theme-intent tool", () => {
  it("accepts themeId and pageId together", async () => {
    const result = await exec("update-theme-intent", {
      themeId: "dark",
      pageId: "page-1",
    });
    expect(result.ok).toBe(true);
  });

  it("rejects when neither themeId nor pageId is provided", async () => {
    const result = await exec("update-theme-intent", {});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.diagnostics.length).toBeGreaterThan(0);
    }
  });
});