import { expect } from "vitest";
import type {
  PersistedSceneGraph,
  SceneGraph,
  SceneNode,
  VisualDocument,
} from "../src/types.js";

export const baseNode = (id: string, type = "container"): SceneNode => ({
  id,
  type,
});

export const makeScene = (
  nodes: Record<string, SceneNode>,
  rootId = "root",
): SceneGraph => ({
  version: 0,
  rootId,
  nodes,
});

export const emptyScene: SceneGraph = makeScene({
  root: { id: "root", type: "container", children: [] },
});

export const emptyPersistedScene: PersistedSceneGraph = {
  version: 0,
  rootId: "root-1",
  nodes: { "root-1": { id: "root-1", type: "container" } },
};

export const emptyDoc: VisualDocument = {
  id: "doc-1",
  title: "Test",
  pages: [],
  scenes: {},
};

export function makeDoc(overrides?: Partial<VisualDocument>): VisualDocument {
  return { id: "doc-1", title: "Test", pages: [], scenes: {}, ...overrides };
}

export function expectThrowsWithCode(
  fn: () => void,
  expectedCode: string,
): void {
  try {
    fn();
  } catch (e) {
    expect((e as { code?: string }).code).toBe(expectedCode);
    return;
  }
  throw new Error("Expected function to throw, but it did not");
}
