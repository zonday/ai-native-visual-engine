import type { SceneGraph } from "@ai-native/core";
import { describe, expect, it } from "vitest";
import {
  toPersistedLayout,
  toPersistedNode,
  toPersistedScene,
} from "../src/persisted-scene.js";

function makeScene(): SceneGraph {
  return {
    version: 1,
    rootId: "root",
    nodes: {
      root: {
        id: "root",
        type: "container",
        children: ["a"],
      },
      a: {
        id: "a",
        type: "text",
        parentId: "root",
        style: { color: "blue" },
        bindings: [{ key: "value", source: "dataset:sales" }],
        layout: {
          mode: "absolute",
          x: 10,
          y: 20,
          width: 100,
          height: 40,
        },
        runtime: { transient: true },
      },
    },
    selection: { nodeIds: ["a"] },
    viewport: { x: 10, y: 20, zoom: 2 },
    metadata: { title: "Scene" },
  };
}

describe("toPersistedLayout", () => {
  it("keeps valid flex layouts", () => {
    expect(
      toPersistedLayout({
        mode: "flex",
        direction: "horizontal",
        gap: 8,
        align: "center",
        justify: "space-between",
        wrap: true,
      }),
    ).toEqual({
      mode: "flex",
      direction: "horizontal",
      gap: 8,
      align: "center",
      justify: "space-between",
      wrap: true,
    });
  });

  it("keeps valid grid and grid-item layouts", () => {
    expect(
      toPersistedLayout({
        mode: "grid",
        columns: 4,
        rowHeight: 120,
        gap: 12,
        autoFlow: "row",
      }),
    ).toEqual({
      mode: "grid",
      columns: 4,
      rowHeight: 120,
      gap: 12,
      autoFlow: "row",
    });

    expect(
      toPersistedLayout({
        mode: "grid-item",
        x: 1,
        y: 2,
        w: 3,
        h: 4,
        minW: 2,
      }),
    ).toEqual({
      mode: "grid-item",
      x: 1,
      y: 2,
      w: 3,
      h: 4,
      minW: 2,
      minH: undefined,
      maxW: undefined,
      maxH: undefined,
    });
  });

  it("returns undefined for invalid layouts", () => {
    expect(
      toPersistedLayout({
        mode: "bogus",
      } as unknown as SceneGraph["nodes"][string]["layout"]),
    ).toBeUndefined();
  });
});

describe("toPersistedNode", () => {
  it("drops invalid layout values from persisted nodes", () => {
    const node = {
      id: "a",
      type: "text",
      layout: { mode: "bogus" },
    } as unknown as SceneGraph["nodes"][string];

    expect(toPersistedNode(node).layout).toBeUndefined();
  });
});

describe("toPersistedScene", () => {
  it("removes session-only selection and viewport fields", () => {
    const scene = makeScene();
    const persisted = toPersistedScene(scene);

    expect(persisted).toEqual({
      version: 1,
      rootId: "root",
      nodes: {
        root: {
          id: "root",
          type: "container",
          children: ["a"],
          parentId: undefined,
          name: undefined,
          props: undefined,
          style: undefined,
          layout: undefined,
          bindings: undefined,
          runtime: undefined,
          visible: undefined,
          locked: undefined,
          prototypeId: undefined,
        },
        a: {
          id: "a",
          type: "text",
          parentId: "root",
          children: undefined,
          name: undefined,
          props: undefined,
          style: { color: "blue" },
          layout: {
            mode: "absolute",
            x: 10,
            y: 20,
            width: 100,
            height: 40,
            rotation: undefined,
            zIndex: undefined,
          },
          bindings: [{ key: "value", source: "dataset:sales" }],
          runtime: { transient: true },
          visible: undefined,
          locked: undefined,
          prototypeId: undefined,
        },
      },
      metadata: { title: "Scene" },
    });
  });

  it("preserves legal persisted fields while stripping session-only state", () => {
    const scene = makeScene();
    const persisted = toPersistedScene(scene);

    expect(persisted.nodes.a?.style).toEqual({ color: "blue" });
    expect(persisted.nodes.a?.bindings).toEqual([
      { key: "value", source: "dataset:sales" },
    ]);
    expect(persisted.metadata).toEqual({ title: "Scene" });
  });
});
