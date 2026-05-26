import { describe, it, expect } from "vitest";
import { createInverseRegistry, computeInverseAction } from "../src/document/inverse-registry.js";
import type { VisualDocument } from "../src/types.js";
import type { DocumentAction } from "../src/document/actions.js";
import { emptyDoc } from "./helpers.js";

describe("createInverseRegistry", () => {
  it("creates a Map from a record of computers", () => {
    const registry = createInverseRegistry({
      "test-action": (_doc, _act, _ctx) => ({ type: "rename-page", pageId: "p1", name: "Undo" }),
    });
    expect(registry.get("test-action")).toBeDefined();
    expect(registry.get("nonexistent")).toBeUndefined();
  });
});

describe("computeInverseAction", () => {
  it("returns undefined for unregistered type", () => {
    const registry = createInverseRegistry({});
    const result = computeInverseAction(
      registry,
      emptyDoc,
      { type: "unknown" } as never,
      { now: Date.now },
    );
    expect(result).toBeUndefined();
  });

  it("calls the registered computer and returns its result", () => {
    let capturedDoc: VisualDocument | undefined;
    const registry = createInverseRegistry({
      "test-action": (doc, _act, _ctx) => {
        capturedDoc = doc;
        return { type: "rename-page", pageId: "p1", name: "Undo" };
      },
    });
    const result = computeInverseAction(
      registry,
      emptyDoc,
      { type: "test-action" } as never,
      { now: Date.now },
    );
    expect(capturedDoc).toBe(emptyDoc);
    expect(result).toEqual({ type: "rename-page", pageId: "p1", name: "Undo" });
  });

  it("returns undefined when computer returns undefined", () => {
    const registry = createInverseRegistry({
      "test-action": () => undefined,
    });
    const result = computeInverseAction(
      registry,
      emptyDoc,
      { type: "test-action" } as never,
      { now: Date.now },
    );
    expect(result).toBeUndefined();
  });
});
