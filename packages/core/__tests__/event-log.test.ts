import { describe, it, expect } from "vitest";
import { createDocumentEventLog, appendDocumentEvent } from "../src/document/event-log.js";
import type { VisualDocument } from "../src/types.js";

const emptyDoc: VisualDocument = {
  id: "doc-1",
  title: "Test",
  pages: [],
  scenes: {},
};

describe("DocumentEventLog", () => {
  it("createDocumentEventLog creates log with initial document and empty actions", () => {
    const log = createDocumentEventLog(emptyDoc);
    expect(log.initialDocument).toBe(emptyDoc);
    expect(log.actions).toHaveLength(0);
  });

  it("appendDocumentEvent appends an entry immutably", () => {
    const log = createDocumentEventLog(emptyDoc);
    const entry1 = {
      action: { type: "rename-page" as const, pageId: "p1", name: "New" },
      actorId: "user-1",
      timestamp: 1000,
    };
    const log2 = appendDocumentEvent(log, entry1);
    expect(log2.actions).toHaveLength(1);
    expect(log2.actions[0]?.action).toEqual(entry1.action);
    expect(log2.actions[0]?.actorId).toBe("user-1");
    expect(log2.actions[0]?.timestamp).toBe(1000);

    const entry2 = {
      action: { type: "remove-page" as const, pageId: "p2" },
      timestamp: 2000,
    };
    const log3 = appendDocumentEvent(log2, entry2);
    expect(log3.actions).toHaveLength(2);
    expect(log3.actions[1]?.action).toEqual(entry2.action);
    expect(log3.actions[1]?.actorId).toBeUndefined();
  });

  it("does not mutate original log on append", () => {
    const log = createDocumentEventLog(emptyDoc);
    appendDocumentEvent(log, {
      action: { type: "rename-page" as const, pageId: "p1", name: "New" },
      timestamp: 1000,
    });
    expect(log.actions).toHaveLength(0);
  });
});
