import { describe, it, expect } from "vitest";
import {
  serializeDocument,
  serializeEventLog,
  CURRENT_SERIALIZATION_VERSION,
} from "../src/serialization.js";
import { createNewDocument } from "../src/bootstrap.js";
import type { DocumentSnapshot } from "../src/types.js";
import type { DocumentAction } from "../src/document/actions.js";

describe("serializeDocument", () => {
  it("wraps a snapshot with version and timestamp", () => {
    const doc = createNewDocument({ title: "Test" });
    const snapshot: DocumentSnapshot = { document: doc };
    const serialized = serializeDocument(snapshot);

    expect(serialized.version).toBe(CURRENT_SERIALIZATION_VERSION);
    expect(serialized.type).toBe("document-snapshot");
    expect(serialized.timestamp).toBeGreaterThan(0);
    expect(serialized.payload).toBe(snapshot);
  });
});

describe("serializeEventLog", () => {
  it("wraps actions with version and context metadata", () => {
    const actions = [{ type: "rename-page", pageId: "p1", name: "New" }] as DocumentAction[];
    const serialized = serializeEventLog("document", "doc-1", "hash-abc", actions);

    expect(serialized.version).toBe(CURRENT_SERIALIZATION_VERSION);
    expect(serialized.type).toBe("event-log");
    expect(serialized.context).toBe("document");
    expect(serialized.contextId).toBe("doc-1");
    expect(serialized.checkpointHash).toBe("hash-abc");
    expect(serialized.actions).toBe(actions);
  });
});

describe("CURRENT_SERIALIZATION_VERSION", () => {
  it("is a positive integer", () => {
    expect(CURRENT_SERIALIZATION_VERSION).toBeGreaterThan(0);
  });
});
