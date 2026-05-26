import { describe, it, expect } from "vitest";
import type { SemanticAction } from "../src/compiler/types.js";
import { compileSemanticAction } from "../src/compiler/pipeline.js";

describe("compileSemanticAction", () => {
  it("rejects unknown action type with invalid-action diagnostic from Zod", () => {
    const action = { type: "unknown-action" } as unknown as SemanticAction;
    const result = compileSemanticAction(action);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.diagnostics[0]?.code).toBe("compiler.invalid-action");
    }
  });

  it("rejects create-dashboard without title", () => {
    const action = { type: "create-dashboard" } as unknown as SemanticAction;
    const result = compileSemanticAction(action);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.diagnostics[0]?.code).toBe("compiler.invalid-action");
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
      expect(result.diagnostics[0]?.code).toBe("compiler.invalid-action");
    }
  });

  it("short-circuits on first stage failure with single diagnostic", () => {
    const result = compileSemanticAction(
      {
        type: "insert-chart",
        containerId: "missing-container",
        chartType: "chart",
      },
      {
        scene: {
          nodes: { "existing": { id: "existing", type: "container", children: [] } },
        },
      },
    );

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
      const gridNode = createNodes.find((n) => n.node.type === "grid");
      expect(gridNode).toBeDefined();
      expect(gridNode?.node.layout).toMatchObject({ mode: "grid", columns: 12 });
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
      expect(result.plan.runtimeActions[0]?.type).toBe("create-node");
      expect(
        (result.plan.runtimeActions[0] as { node: { layout: Record<string, unknown> } } | undefined)
          ?.node.layout,
      ).toMatchObject({ mode: "grid-item" });
    }
  });

  it("rejects auto-layout without pageId", () => {
    const result = compileSemanticAction({
      type: "auto-layout",
      strategy: "balanced",
    } as unknown as SemanticAction);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.diagnostics[0]?.code).toBe("compiler.invalid-action");
    }
  });

  it("rejects auto-layout without strategy", () => {
    const result = compileSemanticAction({
      type: "auto-layout",
      pageId: "page-1",
    } as unknown as SemanticAction);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.diagnostics[0]?.code).toBe("compiler.invalid-action");
    }
  });

  it("accepts auto-layout action and produces empty plan when no scene context", () => {
    const result = compileSemanticAction({
      type: "auto-layout",
      pageId: "page-1",
      strategy: "balanced",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.plan.documentActions).toHaveLength(0);
      expect(result.plan.runtimeActions).toHaveLength(0);
    }
  });

  it("rejects create-dashboard with non-array widgets", () => {
    const result = compileSemanticAction({
      type: "create-dashboard",
      title: "Bad Dashboard",
      widgets: "not-an-array",
    } as unknown as SemanticAction);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.diagnostics[0]?.code).toBe("compiler.invalid-action");
    }
  });

  it("rejects insert-chart with non-array dimensions", () => {
    const result = compileSemanticAction({
      type: "insert-chart",
      containerId: "grid-1",
      chartType: "chart",
      dimensions: "not-an-array",
    } as unknown as SemanticAction);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.diagnostics[0]?.code).toBe("compiler.invalid-action");
    }
  });

  it("rejects insert-chart with non-array metrics", () => {
    const result = compileSemanticAction({
      type: "insert-chart",
      containerId: "grid-1",
      chartType: "chart",
      metrics: "not-an-array",
    } as unknown as SemanticAction);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.diagnostics[0]?.code).toBe("compiler.invalid-action");
    }
  });

  it("rejects update-theme-intent without themeId or pageId", () => {
    const result = compileSemanticAction({
      type: "update-theme-intent",
    } as unknown as SemanticAction);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.diagnostics[0]?.code).toBe(
        "compiler.missing-theme-or-page",
      );
    }
  });

  it("accepts update-theme-intent with themeId and produces set-document-theme action", () => {
    const result = compileSemanticAction({
      type: "update-theme-intent",
      themeId: "dark",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.plan.documentActions).toHaveLength(1);
      expect(result.plan.documentActions[0]?.type).toBe("set-document-theme");
      expect(result.plan.runtimeActions).toHaveLength(0);
    }
  });

  it("accepts create-dashboard without widgets or explicit layout", () => {
    const result = compileSemanticAction({
      type: "create-dashboard",
      title: "Default Dashboard",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.plan.documentActions).toHaveLength(1);
      expect(result.plan.documentActions[0]?.type).toBe("create-page");
      expect(result.plan.runtimeActions).toHaveLength(1);
    }
  });

  it("rejects null action with invalid-action diagnostic", () => {
    const result = compileSemanticAction(null as unknown as SemanticAction);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.diagnostics[0]?.code).toBe("compiler.invalid-action");
    }
  });

  it("produces different widget positions for compact vs balanced layout strategies", () => {
    const compactResult = compileSemanticAction({
      type: "create-dashboard",
      title: "Compact",
      layout: "compact",
      widgets: [
        { type: "chart", w: 8, h: 3 },
        { type: "metric-value", w: 4, h: 5 },
        { type: "kpi", w: 4, h: 2 },
      ],
    });

    const balancedResult = compileSemanticAction({
      type: "create-dashboard",
      title: "Balanced",
      layout: "balanced",
      widgets: [
        { type: "chart", w: 8, h: 3 },
        { type: "metric-value", w: 4, h: 5 },
        { type: "kpi", w: 4, h: 2 },
      ],
    });

    expect(compactResult.ok).toBe(true);
    expect(balancedResult.ok).toBe(true);

    if (compactResult.ok && balancedResult.ok) {
      const compactWidgets = compactResult.plan.runtimeActions.filter(
        (a) => a.type === "create-node" && a.node.type !== "grid",
      );
      const balancedWidgets = balancedResult.plan.runtimeActions.filter(
        (a) => a.type === "create-node" && a.node.type !== "grid",
      );

      expect(compactWidgets.length).toBe(balancedWidgets.length);

      const compactPositions = compactWidgets.map(
        (w) => `${(w as unknown as { node: { layout: { x: number; y: number } } }).node.layout.x},${(w as unknown as { node: { layout: { x: number; y: number } } }).node.layout.y}`,
      ).join(";");
      const balancedPositions = balancedWidgets.map(
        (w) => `${(w as unknown as { node: { layout: { x: number; y: number } } }).node.layout.x},${(w as unknown as { node: { layout: { x: number; y: number } } }).node.layout.y}`,
      ).join(";");

      expect(compactPositions).not.toBe(balancedPositions);
    }
  });

  it("rejects insert-chart with missing container producing ContainerNotFound diagnostic", () => {
    const result = compileSemanticAction(
      {
        type: "insert-chart",
        containerId: "nonexistent-container",
        chartType: "chart",
      },
      { scene: { nodes: { "existing-node": { id: "existing-node", type: "container", children: [] } } } },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.diagnostics[0]?.code).toBe("compiler.container-not-found");
    }
  });

  it("passes insert-chart when container exists in scene context", () => {
    const result = compileSemanticAction(
      {
        type: "insert-chart",
        containerId: "grid-1",
        chartType: "chart",
        dimensions: ["year"],
        metrics: ["revenue"],
      },
      { scene: { nodes: { "grid-1": { id: "grid-1", type: "grid", children: [] } } } },
    );

    expect(result.ok).toBe(true);
  });

  it("rejects auto-layout with missing page producing PageNotFound diagnostic", () => {
    const result = compileSemanticAction(
      {
        type: "auto-layout",
        pageId: "nonexistent-page",
        strategy: "balanced",
      },
      { scene: { nodes: { "existing-node": { id: "existing-node", type: "container", children: [] } } } },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.diagnostics[0]?.code).toBe("compiler.page-not-found");
    }
  });

  it("accepts update-theme-intent with themeId and pageId producing set-page-theme action", () => {
    const result = compileSemanticAction({
      type: "update-theme-intent",
      themeId: "dark",
      pageId: "page-1",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.plan.documentActions).toHaveLength(1);
      expect(result.plan.documentActions[0]?.type).toBe("set-page-theme");
      const action = result.plan.documentActions[0] as { type: string; pageId: string; themeId: string };
      expect(action.pageId).toBe("page-1");
      expect(action.themeId).toBe("dark");
    }
  });

  it("accepts update-theme-intent with pageId only producing set-page-theme without themeId", () => {
    const result = compileSemanticAction({
      type: "update-theme-intent",
      pageId: "page-1",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.plan.documentActions).toHaveLength(1);
      expect(result.plan.documentActions[0]?.type).toBe("set-page-theme");
    }
  });

  it("produces update-layout runtime actions for auto-layout when scene context has children", () => {
    const result = compileSemanticAction(
      {
        type: "auto-layout",
        pageId: "page-1",
        strategy: "balanced",
      },
      {
        scene: {
          nodes: {
            "page-1": { id: "page-1", type: "container", children: ["widget-1", "widget-2"] },
            "widget-1": { id: "widget-1", type: "chart", layout: { mode: "grid-item" } },
            "widget-2": { id: "widget-2", type: "metric-value", layout: { mode: "grid-item" } },
          },
        },
      },
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.plan.runtimeActions.length).toBeGreaterThan(0);
      const allUpdateLayout = result.plan.runtimeActions.every(
        (a) => a.type === "update-layout",
      );
      expect(allUpdateLayout).toBe(true);
    }
  });

  it("produces presentation layout with centered widgets", () => {
    const result = compileSemanticAction({
      type: "create-dashboard",
      title: "Presentation",
      layout: "presentation",
      widgets: [
        { type: "chart", w: 8, h: 6 },
      ],
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      const widgetNodes = result.plan.runtimeActions.filter(
        (a) => a.type === "create-node" && a.node.type !== "grid",
      );
      expect(widgetNodes).toHaveLength(1);
      const layout = (widgetNodes[0] as unknown as { node: { layout: { x: number; w: number } } }).node.layout;
      expect(layout.x).toBe(2);
      expect(layout.w).toBe(8);
    }
  });

  it("rejects create-dashboard with invalid widget dimensions", () => {
    const result = compileSemanticAction({
      type: "create-dashboard",
      title: "Test",
      widgets: [
        { type: "metric", title: "Bad", w: 0, h: 0 },
      ],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.diagnostics[0]?.code).toBe("compiler.invalid-widget-size");
      expect(result.diagnostics[0]?.message).toContain("invalid dimensions");
    }
  });

  it("rejects create-dashboard when grid overflows from too many widgets", () => {
    const widgets = Array.from({ length: 100 }, (_, i) => ({
      type: "metric-value",
      title: `Widget ${i}`,
      w: 12,
      h: 11,
    }));
    const result = compileSemanticAction({
      type: "create-dashboard",
      title: "Overflow Dashboard",
      layout: "compact",
      widgets,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.diagnostics.some(
        (d) => d.code === "compiler.grid-overflow",
      )).toBe(true);
    }
  });
});
