import { describe, expect, it } from "vitest";
import { createNewDocument } from "../src/bootstrap.js";
import { createDocumentEventLog } from "../src/document/event-log.js";
import { createRuntimeEventLog } from "../src/runtime/event-log.js";
import {
  createSnapshotManager,
  DEFAULT_SNAPSHOT_INTERVAL,
  MAX_DOCUMENT_EVENT_LOG_ACTIONS,
  MAX_SCENE_EVENT_LOG_ACTIONS,
  truncateDocumentEventLog,
  truncateRuntimeEventLog,
} from "../src/snapshot.js";
import type { DocumentSnapshot, PersistedSceneGraph } from "../src/types.js";

const emptySnapshot: DocumentSnapshot = {
  document: createNewDocument(),
};

describe("createSnapshotManager", () => {
  it("returns the current snapshot and event log", () => {
    const docLog = createDocumentEventLog(emptySnapshot.document);
    const manager = createSnapshotManager(emptySnapshot, docLog);
    expect(manager.getSnapshot()).toBe(emptySnapshot);
    expect(manager.getDocumentEventLog()).toBe(docLog);
  });

  it("reports shouldCompact when actions exceed interval", () => {
    const docLog = createDocumentEventLog(emptySnapshot.document);
    const manager = createSnapshotManager(emptySnapshot, docLog, 3);
    expect(manager.shouldCompact()).toBe(false);

    docLog.actions.push({
      action: { type: "rename-page", pageId: "p1", name: "a" },
      timestamp: 1,
    });
    docLog.actions.push({
      action: { type: "rename-page", pageId: "p1", name: "b" },
      timestamp: 2,
    });
    docLog.actions.push({
      action: { type: "rename-page", pageId: "p1", name: "c" },
      timestamp: 3,
    });

    expect(manager.shouldCompact()).toBe(true);
  });
});

describe("truncateDocumentEventLog", () => {
  it("removes actions before the checkpoint version", () => {
    const docLog = createDocumentEventLog(emptySnapshot.document);
    docLog.actions.push({
      action: { type: "rename-page", pageId: "p1", name: "a" },
      timestamp: 1,
    });
    docLog.actions.push({
      action: { type: "rename-page", pageId: "p1", name: "b" },
      timestamp: 2,
    });
    docLog.actions.push({
      action: { type: "rename-page", pageId: "p1", name: "c" },
      timestamp: 3,
    });

    const truncated = truncateDocumentEventLog(docLog, 2);
    expect(truncated.actions).toHaveLength(1);
    expect((truncated.actions[0]?.action as any).name).toBe("c");
  });
});

describe("truncateRuntimeEventLog", () => {
  it("removes actions before the checkpoint version", () => {
    const scene: PersistedSceneGraph = {
      version: 0,
      rootId: "root",
      nodes: { root: { id: "root", type: "container" } },
    };
    const log = createRuntimeEventLog(scene);
    log.actions.push({
      action: {
        type: "create-node",
        node: { id: "a", type: "container" },
        parentId: "root",
      },
      timestamp: 1,
    });
    log.actions.push({
      action: {
        type: "create-node",
        node: { id: "b", type: "container" },
        parentId: "root",
      },
      timestamp: 2,
    });

    const truncated = truncateRuntimeEventLog(log, 1);
    expect(truncated.actions).toHaveLength(1);
  });
});

describe("constants", () => {
  it("has reasonable default values", () => {
    expect(DEFAULT_SNAPSHOT_INTERVAL).toBe(100);
    expect(MAX_DOCUMENT_EVENT_LOG_ACTIONS).toBe(1000);
    expect(MAX_SCENE_EVENT_LOG_ACTIONS).toBe(500);
  });
});
