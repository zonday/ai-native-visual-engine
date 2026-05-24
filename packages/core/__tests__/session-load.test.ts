import { describe, it, expect } from "vitest";
import { createNewDocument } from "../src/bootstrap.js";
import {
  openDocumentFromSnapshot,
  loadDocument,
} from "../src/session.js";
import type { DocumentSnapshot } from "../src/types.js";

describe("loadDocument", () => {
  it("loads a valid document snapshot with no damaged pages", () => {
    const doc = createNewDocument({ title: "Test" });
    const snapshot: DocumentSnapshot = { document: doc };
    const result = loadDocument(snapshot);
    expect(result.ok).toBe(true);
    expect(result.document).toBeDefined();
    expect(result.damagedPageIds).toBeUndefined();
  });

  it("detects missing scenes as damaged pages", () => {
    const doc = createNewDocument({ title: "Test" });
    const brokenSnapshot: DocumentSnapshot = {
      document: {
        ...doc,
        pages: [
          ...doc.pages,
          { id: "orphan", name: "Orphan", sceneId: "missing-scene" },
        ],
      },
    };
    const result = loadDocument(brokenSnapshot);
    expect(result.ok).toBe(false);
    expect(result.damagedPageIds).toContain("orphan");
  });

  it("returns diagnostics for invalid document", () => {
    const result = loadDocument({ document: { foo: "bar" } } as unknown as DocumentSnapshot);
    expect(result.ok).toBe(false);
    expect(result.diagnostics.length).toBeGreaterThan(0);
  });
});

describe("openDocumentFromSnapshot", () => {
  it("opens a session from a valid snapshot", () => {
    const doc = createNewDocument({ title: "Test" });
    const snapshot: DocumentSnapshot = { document: doc };
    const session = openDocumentFromSnapshot(snapshot);
    expect(session.state.isOpen).toBe(true);
    expect(session.getActiveScene().rootId).toBeDefined();
  });

  it("throws SessionError for invalid snapshot", () => {
    const snapshot = { document: { invalid: true } } as unknown as DocumentSnapshot;
    expect(() => openDocumentFromSnapshot(snapshot)).toThrow();
  });
});
