// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { SceneNode, VisualDocument } from "@ai-native/core";
import type { ComponentRegistry } from "@ai-native/renderer-react";
import { Editor } from "../src/Editor.js";
import { useEditorStore } from "../src/store.js";

function createDocument(): VisualDocument {
  const scene = { version: 0, rootId: "root", nodes: {} as Record<string, SceneNode> };
  return {
    id: "doc-1",
    title: "Test Document",
    pages: [{ id: "page-1", name: "Page 1", sceneId: "scene-1" }],
    scenes: { "scene-1": scene },
    activeThemeId: "base",
  };
}

const emptyRegistry: ComponentRegistry = new Map();
const baseContext = {
  mode: "editor" as const,
  pageId: "page-1" as const,
  scene: { version: 0, rootId: "root", nodes: {} },
  selection: { nodeIds: [] },
};

describe("Editor", () => {
  beforeEach(() => {
    cleanup();
    useEditorStore.setState({
      nodeIds: [],
      viewport: { x: 0, y: 0, zoom: 1 },
      activePageId: "page-1",
    });
  });

  it("renders page list with page names", () => {
    const doc = createDocument();

    render(
      <Editor document={doc} registry={emptyRegistry} context={baseContext} />,
    );

    expect(screen.getByText("Page 1")).toBeDefined();
    expect(screen.getByText("Pages")).toBeDefined();
  });

  it("renders inspector panel heading", () => {
    const doc = createDocument();
    const scene = doc.scenes["scene-1"];
    if (!scene) throw new Error("scene-1 fixture not found");
    scene.nodes["n1"] = {
      id: "n1",
      type: "text",
      parentId: "root",
    };
    useEditorStore.setState({ nodeIds: ["n1"] });

    render(
      <Editor document={doc} registry={emptyRegistry} context={baseContext} />,
    );

    expect(screen.getByText("Inspector")).toBeDefined();
  });

  it("renders layers panel when a page is active", () => {
    const doc = createDocument();

    render(
      <Editor document={doc} registry={emptyRegistry} context={baseContext} />,
    );

    expect(screen.getByText("Layers")).toBeDefined();
  });
});
