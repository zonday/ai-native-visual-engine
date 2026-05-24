import { describe, it, expect } from "vitest";
import { createNewDocument } from "../src/bootstrap.js";
import {
  InMemoryStorageBackend,
} from "../src/storage-backend.js";
import type { DocumentSnapshot } from "../src/types.js";
import type { DocumentAction } from "../src/document/actions.js";
import type { RuntimeAction } from "../src/runtime/actions.js";

describe("InMemoryStorageBackend", () => {
  it("saves and loads a document snapshot", async () => {
    const backend = new InMemoryStorageBackend();
    const doc = createNewDocument({ title: "Test" });
    const snapshot: DocumentSnapshot = { document: doc };

    await backend.saveDocument(snapshot);
    const loaded = await backend.loadDocument(doc.id);

    expect(loaded).not.toBeNull();
    expect(loaded!.document.id).toBe(doc.id);
  });

  it("returns null for unknown document", async () => {
    const backend = new InMemoryStorageBackend();
    const loaded = await backend.loadDocument("unknown");
    expect(loaded).toBeNull();
  });

  it("appends and loads event logs", async () => {
    const backend = new InMemoryStorageBackend();
    const actions: DocumentAction[] = [{ type: "rename-page", pageId: "p1", name: "New" }];

    await backend.appendEventLog("document", "doc-1", actions);
    const loaded = await backend.loadEventLog("document", "doc-1");

    expect(loaded).toHaveLength(1);
    expect(loaded[0]?.type).toBe("rename-page");
  });

  it("preserves existing events on append", async () => {
    const backend = new InMemoryStorageBackend();
    await backend.appendEventLog("scene", "scene-1", [
      { type: "create-node", node: { id: "a", type: "container" }, parentId: "root" },
    ] as RuntimeAction[]);
    await backend.appendEventLog("scene", "scene-1", [
      { type: "create-node", node: { id: "b", type: "container" }, parentId: "root" },
    ]);

    const loaded = await backend.loadEventLog("scene", "scene-1");
    expect(loaded).toHaveLength(2);
  });
});
