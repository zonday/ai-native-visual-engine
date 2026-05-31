import type { GridItemLayout, GridLayout, SceneGraph } from "../types.js";

export interface GridItemPosition {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CollisionInfo {
  nodeA: string;
  nodeB: string;
}

export interface LayoutResult {
  positions: GridItemPosition[];
  collisions: CollisionInfo[];
}

function cellsOverlap(a: GridItemPosition, b: GridItemPosition): boolean {
  if (a.w <= 0 || a.h <= 0 || b.w <= 0 || b.h <= 0) return false;
  const aColEnd = a.x + a.w - 1;
  const aRowEnd = a.y + a.h - 1;
  const bColEnd = b.x + b.w - 1;
  const bRowEnd = b.y + b.h - 1;
  return aColEnd >= b.x && bColEnd >= a.x && aRowEnd >= b.y && bRowEnd >= a.y;
}

export function detectCollisions(items: GridItemPosition[]): CollisionInfo[] {
  const collisions: CollisionInfo[] = [];

  for (let i = 0; i < items.length; i++) {
    const a = items[i];
    if (!a) continue;
    for (let j = i + 1; j < items.length; j++) {
      const b = items[j];
      if (!b) continue;
      if (cellsOverlap(a, b)) {
        collisions.push({ nodeA: a.id, nodeB: b.id });
      }
    }
  }

  return collisions;
}

export function resolveCollisions(
  items: GridItemPosition[],
  collisions: CollisionInfo[],
  columns: number,
): GridItemPosition[] {
  const resolved = new Map<string, GridItemPosition>();
  const occupied = new Set<string>();

  const collidingIds = new Set(collisions.map((c) => c.nodeB));

  for (const item of items) {
    const id = item.id;

    if (!collidingIds.has(id)) {
      resolved.set(id, { ...item });
      for (let r = item.y; r < item.y + item.h; r++) {
        for (let c = item.x; c < item.x + item.w; c++) {
          occupied.add(`${c},${r}`);
        }
      }
      continue;
    }

    const maxRows = Math.ceil(items.length / columns) + (item.h - 1);
    let placed = false;
    for (let row = 0; row < maxRows && !placed; row++) {
      for (let col = 0; col < columns; col++) {
        const candidate = { ...item, x: col, y: row };
        if (canPlace(candidate, occupied)) {
          for (let r = row; r < row + item.h; r++) {
            for (let c = col; c < col + item.w; c++) {
              occupied.add(`${c},${r}`);
            }
          }
          resolved.set(id, candidate);
          placed = true;
          break;
        }
      }
    }

    if (!placed) {
      resolved.set(id, { ...item });
    }
  }

  return Array.from(resolved.values());
}

function canPlace(candidate: GridItemPosition, occupied: Set<string>): boolean {
  for (let r = candidate.y; r < candidate.y + candidate.h; r++) {
    for (let c = candidate.x; c < candidate.x + candidate.w; c++) {
      if (occupied.has(`${c},${r}`)) return false;
    }
  }
  return true;
}

export function autoLayoutGrid(
  scene: SceneGraph,
  containerId: string,
): LayoutResult {
  const container = scene.nodes[containerId];
  if (!container) return { positions: [], collisions: [] };

  const gridLayout = container.layout as GridLayout | undefined;
  const columns = Number.isFinite(gridLayout?.columns)
    ? (gridLayout?.columns as number)
    : 4;

  const childIds = container.children ?? [];

  const items: GridItemPosition[] = [];
  const occupied = new Set<string>();

  for (const id of childIds) {
    const node = scene.nodes[id];
    if (!node) continue;
    const layout = node.layout as GridItemLayout | undefined;

    let x = Number.isFinite(layout?.x) ? (layout?.x as number) : undefined;
    let y = Number.isFinite(layout?.y) ? (layout?.y as number) : undefined;
    const w = Math.max(
      Number.isFinite(layout?.w) ? (layout?.w as number) : 1,
      1,
    );
    const h = Math.max(
      Number.isFinite(layout?.h) ? (layout?.h as number) : 1,
      1,
    );

    if (x === undefined || y === undefined) {
      let found = false;
      const maxRows = childIds.length + h;
      for (let row = 0; row < maxRows && !found; row++) {
        for (let col = 0; col < columns && !found; col++) {
          let allFree = true;
          for (let r = row; r < row + h && allFree; r++) {
            for (let c = col; c < col + w && allFree; c++) {
              if (c >= columns || occupied.has(`${c},${r}`)) {
                allFree = false;
              }
            }
          }
          if (allFree) {
            x = col;
            y = row;
            found = true;
          }
        }
      }
    }

    if (x === undefined) {
      const maxRow =
        occupied.size === 0
          ? 0
          : Math.max(
              ...Array.from(occupied.keys()).map((k) =>
                Number.parseInt(k.split(",")[1] || "0", 10),
              ),
            );
      x = 0;
      y = maxRow + 1;
    }
    if (y === undefined) y = 0;

    for (let r = y; r < y + h; r++) {
      for (let c = x; c < x + w; c++) {
        occupied.add(`${c},${r}`);
      }
    }

    items.push({ id, x, y, w, h });
  }

  const collisions = detectCollisions(items);

  return { positions: items, collisions };
}
