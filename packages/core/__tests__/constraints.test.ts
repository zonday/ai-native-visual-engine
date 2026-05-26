import { describe, it, expect, beforeEach } from "vitest";
import type { SceneGraph, SceneNode } from "../src/types.js";
import {
  createConstraintRegistry,
  type ConstraintRegistry,
} from "../src/constraints/constraint-registry.js";
import {
  createChartInContainerConstraint,
  createGridItemParentConstraint,
  createRootCannotBeRemovedConstraint,
  createUniqueNodeIdConstraint,
} from "../src/constraints/structural-constraints.js";
import {
  createWidgetSizeConstraint,
  createGridColumnConstraint,
} from "../src/constraints/layout-constraints.js";
import { createConstraintMiddleware } from "../src/constraints/constraint-middleware.js";

function makeScene(nodes: Record<string, SceneNode>): SceneGraph {
  return { version: 0, rootId: "root", nodes };
}

describe("ConstraintRegistry", () => {
  let registry: ConstraintRegistry;

  beforeEach(() => {
    registry = createConstraintRegistry();
    registry.register(createUniqueNodeIdConstraint());
    registry.register(createRootCannotBeRemovedConstraint());
  });

  it("passes valid actions with no violations", () => {
    const scene = makeScene({
      root: { id: "root", type: "container", children: [] },
    });
    const report = registry.validate({
      scene,
      action: {
        type: "create-node",
        node: { id: "new", type: "text" },
        parentId: "root",
      },
    });
    expect(report.pass).toBe(true);
    expect(report.violations).toHaveLength(0);
  });

  it("rejects duplicate node ID", () => {
    const scene = makeScene({
      root: { id: "root", type: "container" },
      existing: { id: "existing", type: "text" },
    });
    const report = registry.validate({
      scene,
      action: {
        type: "create-node",
        node: { id: "existing", type: "text" },
        parentId: "root",
      },
    });
    expect(report.pass).toBe(false);
    expect(report.violations[0]?.code).toBe("structural.unique-node-id");
  });
});

describe("Chart in container constraint", () => {
  const c = createChartInContainerConstraint();

  it("rejects chart outside container", () => {
    const result = c.evaluate({
      scene: makeScene({
        root: { id: "root", type: "grid" },
      }),
      action: {
        type: "create-node",
        node: { id: "chart-1", type: "chart", parentId: "root" },
        parentId: "root",
      },
    });
    expect(result.pass).toBe(false);
  });

  it("allows chart inside container", () => {
    const result = c.evaluate({
      scene: makeScene({
        root: { id: "root", type: "container" },
      }),
      action: {
        type: "create-node",
        node: { id: "chart-1", type: "chart", parentId: "root" },
        parentId: "root",
      },
    });
    expect(result.pass).toBe(true);
  });
});

describe("Grid item parent constraint", () => {
  const c = createGridItemParentConstraint();

  it("rejects grid-item outside grid", () => {
    const result = c.evaluate({
      scene: makeScene({
        root: { id: "root", type: "container" },
      }),
      action: {
        type: "create-node",
        node: {
          id: "item-1",
          type: "metric-value",
          parentId: "root",
          layout: { mode: "grid-item" },
        },
        parentId: "root",
      },
    });
    expect(result.pass).toBe(false);
  });

  it("allows grid-item inside grid", () => {
    const result = c.evaluate({
      scene: makeScene({
        root: { id: "root", type: "grid" },
      }),
      action: {
        type: "create-node",
        node: {
          id: "item-1",
          type: "metric-value",
          parentId: "root",
          layout: { mode: "grid-item" },
        },
        parentId: "root",
      },
    });
    expect(result.pass).toBe(true);
  });
});

describe("Root cannot be removed", () => {
  const c = createRootCannotBeRemovedConstraint();

  it("rejects removing root node", () => {
    const result = c.evaluate({
      scene: makeScene({
        root: { id: "root", type: "container" },
      }),
      action: { type: "remove-node", nodeId: "root" },
    });
    expect(result.pass).toBe(false);
  });

  it("allows removing non-root node", () => {
    const result = c.evaluate({
      scene: makeScene({
        root: { id: "root", type: "container" },
        child: { id: "child", type: "text" },
      }),
      action: { type: "remove-node", nodeId: "child" },
    });
    expect(result.pass).toBe(true);
  });
});

describe("Widget size constraint", () => {
  const c = createWidgetSizeConstraint();

  it("rejects negative width", () => {
    const result = c.evaluate({
      scene: makeScene({ root: { id: "root", type: "container" } }),
      action: {
        type: "update-layout",
        nodeId: "widget-1",
        layout: { mode: "grid-item", x: 0, y: 0, w: -1, h: 3 },
      },
    });
    expect(result.pass).toBe(false);
  });

  it("allows positive dimensions", () => {
    const result = c.evaluate({
      scene: makeScene({ root: { id: "root", type: "container" } }),
      action: {
        type: "update-layout",
        nodeId: "widget-1",
        layout: { mode: "grid-item", x: 0, y: 0, w: 4, h: 3 },
      },
    });
    expect(result.pass).toBe(true);
  });
});

describe("Constraint middleware", () => {
  it("passes through valid actions", () => {
    const registry = createConstraintRegistry();
    const mw = createConstraintMiddleware(registry);

    let called = false;
    const result = mw(
      { type: "create-node", node: { id: "x", type: "text" }, parentId: "root" },
      makeScene({ root: { id: "root", type: "container" } }),
      () => {
        called = true;
        return {
          ok: true,
          scene: makeScene({
            root: { id: "root", type: "container" },
            x: { id: "x", type: "text" },
          }),
        };
      },
    );
    expect(called).toBe(true);
    expect(result.ok).toBe(true);
  });

  it("blocks action when constraint fails", () => {
    const registry = createConstraintRegistry();
    registry.register(createRootCannotBeRemovedConstraint());
    const mw = createConstraintMiddleware(registry);

    const result = mw(
      { type: "remove-node", nodeId: "root" },
      makeScene({ root: { id: "root", type: "container" } }),
      () => ({ ok: true, scene: makeScene({}) }),
    );
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("constraint.violation");
  });
});
