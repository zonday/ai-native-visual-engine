import { describe, it, expect } from "vitest";
import type { SceneGraph, SceneNode } from "../src/types.js";
import {
  autoLayoutGrid,
  detectCollisions,
  resolveCollisions,
} from "../src/grid-layout.js";
import type { GridItemPosition } from "../src/grid-layout.js";

function makeScene(nodes: Record<string, SceneNode>): SceneGraph {
  return { version: 0, rootId: "root", nodes };
}

function getItem(
  positions: GridItemPosition[],
  id: string,
): GridItemPosition {
  return positions.find((p) => p.id === id) as GridItemPosition;
}

describe("autoLayoutGrid", () => {
  it("produces positions for all children", () => {
    const scene = makeScene({
      root: {
        id: "root",
        type: "grid",
        children: ["a", "b"],
        layout: { mode: "grid", columns: 4, rowHeight: 60, gap: 16 },
      },
      a: {
        id: "a",
        type: "text",
        parentId: "root",
        layout: { mode: "grid-item", x: 0, y: 0, w: 2, h: 1 },
      },
      b: {
        id: "b",
        type: "text",
        parentId: "root",
        layout: { mode: "grid-item", x: 2, y: 0, w: 1, h: 1 },
      },
    });

    const result = autoLayoutGrid(scene, "root");
    expect(result.positions).toHaveLength(2);

    const a = getItem(result.positions, "a");
    const b = getItem(result.positions, "b");
    expect(a.x).toBe(0);
    expect(a.y).toBe(0);
    expect(a.w).toBe(2);
    expect(a.h).toBe(1);
    expect(b.x).toBe(2);
    expect(b.y).toBe(0);
  });

  it("returns empty result for missing container", () => {
    const scene = makeScene({ root: { id: "root", type: "container" } });
    const result = autoLayoutGrid(scene, "nonexistent");
    expect(result.positions).toHaveLength(0);
    expect(result.collisions).toHaveLength(0);
  });

  it("returns empty result for container with no children", () => {
    const scene = makeScene({
      root: {
        id: "root",
        type: "grid",
        children: [],
        layout: { mode: "grid", columns: 4, rowHeight: 50, gap: 10 },
      },
    });
    const result = autoLayoutGrid(scene, "root");
    expect(result.positions).toHaveLength(0);
  });

  it("auto-places children without explicit x/y", () => {
    const scene = makeScene({
      root: {
        id: "root",
        type: "grid",
        children: ["a", "b"],
        layout: { mode: "grid", columns: 2, rowHeight: 60, gap: 16 },
      },
      a: {
        id: "a",
        type: "text",
        parentId: "root",
        layout: { mode: "grid-item", w: 1, h: 1 },
      },
      b: {
        id: "b",
        type: "text",
        parentId: "root",
        layout: { mode: "grid-item", w: 1, h: 1 },
      },
    });

    const result = autoLayoutGrid(scene, "root");
    expect(result.positions).toHaveLength(2);

    const a = getItem(result.positions, "a");
    const b = getItem(result.positions, "b");
    expect(a.x).toBe(0);
    expect(a.y).toBe(0);
    expect(b.x).toBe(1);
    expect(b.y).toBe(0);
  });

  it("skips ghost childId where node is missing", () => {
    const scene = makeScene({
      root: {
        id: "root",
        type: "grid",
        children: ["a", "ghost"],
        layout: { mode: "grid", columns: 4, rowHeight: 60, gap: 16 },
      },
      a: {
        id: "a",
        type: "text",
        parentId: "root",
        layout: { mode: "grid-item", x: 0, y: 0, w: 1, h: 1 },
      },
    });

    const result = autoLayoutGrid(scene, "root");
    expect(result.positions).toHaveLength(1);
    expect(getItem(result.positions, "a").x).toBe(0);
  });

  it("clamps w/h to at least 1 for degenerate input", () => {
    const scene = makeScene({
      root: {
        id: "root",
        type: "grid",
        children: ["a"],
        layout: { mode: "grid", columns: 4, rowHeight: 60, gap: 16 },
      },
      a: {
        id: "a",
        type: "text",
        parentId: "root",
        layout: { mode: "grid-item", x: 0, y: 0, w: 0, h: -1 },
      },
    });

    const result = autoLayoutGrid(scene, "root");
    const a = getItem(result.positions, "a");
    expect(a.w).toBe(1);
    expect(a.h).toBe(1);
  });

  it("auto-places wrapping to next row when first row is full", () => {
    const scene = makeScene({
      root: {
        id: "root",
        type: "grid",
        children: ["a", "b", "c"],
        layout: { mode: "grid", columns: 2, rowHeight: 60, gap: 16 },
      },
      a: {
        id: "a",
        type: "text",
        parentId: "root",
        layout: { mode: "grid-item", w: 1, h: 1 },
      },
      b: {
        id: "b",
        type: "text",
        parentId: "root",
        layout: { mode: "grid-item", w: 1, h: 1 },
      },
      c: {
        id: "c",
        type: "text",
        parentId: "root",
        layout: { mode: "grid-item", w: 1, h: 1 },
      },
    });

    const result = autoLayoutGrid(scene, "root");
    const a = getItem(result.positions, "a");
    const b = getItem(result.positions, "b");
    const c = getItem(result.positions, "c");
    expect(a.x).toBe(0);
    expect(a.y).toBe(0);
    expect(b.x).toBe(1);
    expect(b.y).toBe(0);
    expect(c.x).toBe(0);
    expect(c.y).toBe(1);
  });

  it("detects collisions for explicitly overlapping items", () => {
    const scene = makeScene({
      root: {
        id: "root",
        type: "grid",
        children: ["a", "b"],
        layout: { mode: "grid", columns: 4, rowHeight: 60, gap: 16 },
      },
      a: {
        id: "a",
        type: "text",
        parentId: "root",
        layout: { mode: "grid-item", x: 0, y: 0, w: 1, h: 1 },
      },
      b: {
        id: "b",
        type: "text",
        parentId: "root",
        layout: { mode: "grid-item", x: 0, y: 0, w: 1, h: 1 },
      },
    });

    const result = autoLayoutGrid(scene, "root");
    expect(result.collisions).toHaveLength(1);
  });
});

describe("detectCollisions", () => {
  it("detects no collisions for non-overlapping items", () => {
    const items: GridItemPosition[] = [
      { id: "a", x: 0, y: 0, w: 1, h: 1 },
      { id: "b", x: 1, y: 0, w: 1, h: 1 },
    ];
    expect(detectCollisions(items)).toHaveLength(0);
  });

  it("detects collision for overlapping cells", () => {
    const items: GridItemPosition[] = [
      { id: "a", x: 0, y: 0, w: 2, h: 1 },
      { id: "b", x: 1, y: 0, w: 1, h: 1 },
    ];
    const collisions = detectCollisions(items);
    expect(collisions).toHaveLength(1);
    expect(collisions[0] as { nodeA: string }).toMatchObject({ nodeA: "a" });
  });

  it("detects collision for vertically overlapping items", () => {
    const items: GridItemPosition[] = [
      { id: "a", x: 0, y: 0, w: 1, h: 2 },
      { id: "b", x: 0, y: 1, w: 1, h: 1 },
    ];
    const collisions = detectCollisions(items);
    expect(collisions).toHaveLength(1);
  });

  it("returns empty for single item", () => {
    const items: GridItemPosition[] = [
      { id: "a", x: 0, y: 0, w: 1, h: 1 },
    ];
    expect(detectCollisions(items)).toHaveLength(0);
  });

  it("detects no collision for items sharing an edge only", () => {
    const items: GridItemPosition[] = [
      { id: "a", x: 0, y: 0, w: 1, h: 1 },
      { id: "b", x: 1, y: 0, w: 1, h: 1 },
    ];
    expect(detectCollisions(items)).toHaveLength(0);
  });

  it("detects two collision pairs among three items", () => {
    const items: GridItemPosition[] = [
      { id: "a", x: 0, y: 0, w: 1, h: 1 },
      { id: "b", x: 0, y: 0, w: 1, h: 1 },
      { id: "c", x: 0, y: 0, w: 1, h: 1 },
    ];
    expect(detectCollisions(items)).toHaveLength(3);
  });

  it("detects no collision when w=0 or h=0", () => {
    const items: GridItemPosition[] = [
      { id: "a", x: 0, y: 0, w: 0, h: 1 },
      { id: "b", x: 0, y: 0, w: 1, h: 1 },
    ];
    expect(detectCollisions(items)).toHaveLength(0);
  });
});

describe("resolveCollisions", () => {
  it("pushes overlapping item to next free cell", () => {
    const items: GridItemPosition[] = [
      { id: "a", x: 0, y: 0, w: 1, h: 1 },
      { id: "b", x: 0, y: 0, w: 1, h: 1 },
    ];
    const collisions = detectCollisions(items);
    const resolved = resolveCollisions(items, collisions, 4);

    const a = getItem(resolved, "a");
    const b = getItem(resolved, "b");

    expect(a.x).toBe(0);
    expect(a.y).toBe(0);
    expect(b.x === a.x && b.y === a.y).toBe(false);
  });

  it("resolves collision respecting item spans (w>1)", () => {
    const items: GridItemPosition[] = [
      { id: "a", x: 0, y: 0, w: 2, h: 1 },
      { id: "b", x: 1, y: 0, w: 1, h: 1 },
    ];
    const collisions = detectCollisions(items);
    const resolved = resolveCollisions(items, collisions, 4);

    const a = getItem(resolved, "a");
    const b = getItem(resolved, "b");
    expect(a.x).toBe(0);
    expect(a.y).toBe(0);
    expect(b.x === a.x && b.y === a.y).toBe(false);
  });

  it("keeps non-colliding items unchanged", () => {
    const items: GridItemPosition[] = [
      { id: "a", x: 0, y: 0, w: 1, h: 1 },
      { id: "b", x: 1, y: 0, w: 1, h: 1 },
    ];
    const collisions = detectCollisions(items);
    const resolved = resolveCollisions(items, collisions, 4);

    expect(resolved).toHaveLength(2);
    expect(getItem(resolved, "a").x).toBe(0);
    expect(getItem(resolved, "b").x).toBe(1);
  });

  it("resolves chain of three colliding items", () => {
    const items: GridItemPosition[] = [
      { id: "a", x: 0, y: 0, w: 1, h: 1 },
      { id: "b", x: 0, y: 0, w: 1, h: 1 },
      { id: "c", x: 0, y: 0, w: 1, h: 1 },
    ];
    const collisions = detectCollisions(items);
    const resolved = resolveCollisions(items, collisions, 4);

    expect(resolved).toHaveLength(3);
    const positions = new Set(resolved.map((p) => `${p.x},${p.y}`));
    expect(positions.size).toBe(3);
  });

  it("resolves collision for item with vertical span (h>1)", () => {
    const items: GridItemPosition[] = [
      { id: "a", x: 0, y: 0, w: 1, h: 1 },
      { id: "b", x: 0, y: 0, w: 1, h: 2 },
    ];
    const collisions = detectCollisions(items);
    const resolved = resolveCollisions(items, collisions, 4);

    const a = getItem(resolved, "a");
    const b = getItem(resolved, "b");
    expect(a.x === b.x && a.y === b.y).toBe(false);
  });

  it("returns same items when no collisions provided", () => {
    const items: GridItemPosition[] = [
      { id: "a", x: 0, y: 0, w: 1, h: 1 },
      { id: "b", x: 1, y: 0, w: 1, h: 1 },
    ];
    const resolved = resolveCollisions(items, [], 4);
    expect(resolved).toHaveLength(2);
    expect(getItem(resolved, "a").x).toBe(0);
    expect(getItem(resolved, "b").x).toBe(1);
  });
});
