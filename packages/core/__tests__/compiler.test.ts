import { describe, it, expect } from "vitest";
import type { SemanticAction } from "../src/compiler/types.js";
import { compileSemanticAction } from "../src/compiler/pipeline.js";

describe("compileSemanticAction", () => {
  it("rejects unknown action type with unsupported-action diagnostic", () => {
    const action = { type: "unknown-action" } as unknown as SemanticAction;
    const result = compileSemanticAction(action);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.diagnostics.length).toBeGreaterThan(0);
      expect(result.diagnostics[0]?.code).toBe("compiler.unsupported-action");
    }
  });

  it("rejects create-dashboard without title", () => {
    const action = { type: "create-dashboard" } as unknown as SemanticAction;
    const result = compileSemanticAction(action);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.diagnostics[0]?.code).toBe("compiler.missing-title");
    }
  });

  it("rejects insert-chart without containerId", () => {
    const action = {
      type: "insert-chart",
      chartType: "chart",
    } as unknown as SemanticAction;
    const result = compileSemanticAction(action);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.diagnostics[0]?.code).toBe("compiler.missing-container");
    }
  });

  it("short-circuits on first stage failure", () => {
    const action = {
      type: "create-dashboard",
    } as unknown as SemanticAction;
    const result = compileSemanticAction(action);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.diagnostics).toHaveLength(1);
    }
  });

  it("produces execution plan for valid create-dashboard", () => {
    const result = compileSemanticAction({
      type: "create-dashboard",
      title: "Test Dashboard",
      widgets: [
        { type: "metric-value", title: "Revenue", w: 4, h: 3 },
        { type: "chart", title: "Trend", w: 8, h: 4 },
      ],
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.plan.documentActions).toHaveLength(1);
      expect(result.plan.documentActions[0]?.type).toBe("create-page");
      expect(result.plan.runtimeActions.length).toBeGreaterThan(0);
      const createNodes = result.plan.runtimeActions.filter(
        (a) => a.type === "create-node",
      );
      expect(createNodes.length).toBe(3);
      const gridNode = createNodes.find((n) => n.node.type === "grid")!;
      expect(gridNode.node.layout).toMatchObject({ mode: "grid", columns: 12 });
      const widgetNodes = createNodes.filter((n) => n.node.type !== "grid");
      for (const wn of widgetNodes) {
        expect(wn.node.layout).toMatchObject({ mode: "grid-item" });
      }
    }
  });

  it("produces execution plan for valid insert-chart", () => {
    const result = compileSemanticAction({
      type: "insert-chart",
      containerId: "grid-1",
      chartType: "chart",
      dataSource: "ds-sales",
      dimensions: ["year"],
      metrics: ["revenue"],
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.plan.documentActions).toHaveLength(0);
      expect(result.plan.runtimeActions).toHaveLength(1);
      const action = result.plan.runtimeActions[0]!;
      expect(action.type).toBe("create-node");
      expect(action.node.layout).toMatchObject({ mode: "grid-item" });
    }
  });

  it("rejects auto-layout without pageId", () => {
    const result = compileSemanticAction({
      type: "auto-layout",
      strategy: "balanced",
    } as unknown as SemanticAction);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.diagnostics[0]?.code).toBe("compiler.missing-page-id");
    }
  });

  it("rejects auto-layout without strategy", () => {
    const result = compileSemanticAction({
      type: "auto-layout",
      pageId: "page-1",
    } as unknown as SemanticAction);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.diagnostics[0]?.code).toBe("compiler.missing-strategy");
    }
  });

  it("rejects auto-layout action because expansion is not yet implemented", () => {
    const result = compileSemanticAction({
      type: "auto-layout",
      pageId: "page-1",
      strategy: "balanced",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.diagnostics[0]?.code).toBe("compiler.not-implemented");
    }
  });

  it("rejects update-theme-intent action because expansion is not yet implemented", () => {
    const result = compileSemanticAction({
      type: "update-theme-intent",
      themeId: "dark",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.diagnostics[0]?.code).toBe("compiler.not-implemented");
    }
  });

  it("accepts create-dashboard without explicit layout", () => {
    const result = compileSemanticAction({
      type: "create-dashboard",
      title: "Default Dashboard",
    });

    expect(result.ok).toBe(true);
  });

  it("rejects null action", () => {
    const result = compileSemanticAction(null as unknown as SemanticAction);

    expect(result.ok).toBe(false);
  });
});
