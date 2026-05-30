import { describe, expect, it } from "vitest";
import type {
  SerializedDocumentAction,
  SerializedRuntimeAction,
} from "../src/collaboration/types.js";

import { createYjsDocProvider } from "../src/collaboration/yjs-provider.js";
import type { DocumentAction } from "../src/document/register-handlers.js";
import type { RuntimeAction } from "../src/runtime/register-handlers.js";

function sda(
  type: string,
  actorId = "a",
  timestamp = 1,
  overrides?: Partial<SerializedDocumentAction>,
): SerializedDocumentAction {
  return {
    actorId,
    timestamp,
    action: { type } as unknown as DocumentAction,
    ...overrides,
  };
}

function sra(
  type: string,
  actorId = "a",
  timestamp = 1,
  pageId = "page-1",
  overrides?: Partial<SerializedRuntimeAction>,
): SerializedRuntimeAction {
  return {
    actorId,
    timestamp,
    pageId,
    action: { type } as unknown as RuntimeAction,
    ...overrides,
  };
}

describe("YjsDocProvider — §4 shared document structure", () => {
  it("has separate documentActions and sceneActions", () => {
    const p = createYjsDocProvider("room-1");
    const doc = p.getDoc();
    const docArr = doc.getArray<SerializedDocumentAction>("documentActions");
    const sceneMap = doc.getMap("sceneActions");
    expect(docArr).toBeDefined();
    expect(sceneMap).toBeDefined();
  });

  it("sceneActions are keyed by pageId", () => {
    const p = createYjsDocProvider("room-2");
    const doc = p.getDoc();
    const map = doc.getMap("sceneActions");

    p.broadcastSceneAction(
      sra("create-node", "a", 1, "page-1", {
        action: {
          type: "create-node",
          node: { id: "n", type: "text" },
          parentId: "root",
        } as unknown as RuntimeAction,
      }),
    );

    expect(map.get("page-1")).toBeDefined();
    const arr = map.get("page-1") as { length: number } | undefined;
    expect(arr?.length).toBe(1);
  });
});

describe("YjsDocProvider — §5.4 serialization envelope", () => {
  it("document action includes actorId and timestamp", () => {
    const p = createYjsDocProvider("room-3");
    let received: SerializedDocumentAction | null = null;
    p.onRemoteDocumentAction((entry) => {
      received = entry;
    });

    p.broadcastDocumentAction(sda("create-page"));

    const docEntry = received as unknown as SerializedDocumentAction;
    expect(docEntry.actorId).toBe("a");
    expect(docEntry.timestamp).toBe(1);
    expect(docEntry.action.type).toBe("create-page");
  });

  it("scene action includes actorId, timestamp, and pageId", () => {
    const p = createYjsDocProvider("room-4");
    let received: SerializedRuntimeAction | null = null;
    p.onRemoteSceneAction("page-1", (entry) => {
      received = entry;
    });

    p.broadcastSceneAction(sra("update-layout"));

    const sceneEntry = received as unknown as SerializedRuntimeAction;
    expect(sceneEntry.actorId).toBe("a");
    expect(sceneEntry.timestamp).toBe(1);
    expect(sceneEntry.pageId).toBe("page-1");
    expect(sceneEntry.action.type).toBe("update-layout");
  });
});

describe("YjsDocProvider — §8 replay", () => {
  it("replays existing document actions on join", () => {
    const p = createYjsDocProvider("room-5");
    p.broadcastDocumentAction(sda("create-page"));
    p.broadcastDocumentAction(sda("rename-page", "b", 2));

    const replayed: string[] = [];
    p.replayDocumentActions((entry) => {
      replayed.push(entry.action.type);
    });
    expect(replayed).toEqual(["create-page", "rename-page"]);
  });

  it("replays existing scene actions for a page on join", () => {
    const p = createYjsDocProvider("room-6");
    p.broadcastSceneAction(
      sra("create-node", "a", 1, "page-x", {
        action: {
          type: "create-node",
          node: { id: "n", type: "text" },
          parentId: "root",
        } as unknown as RuntimeAction,
      }),
    );

    const replayed: string[] = [];
    p.replaySceneActions("page-x", (entry) => {
      replayed.push(entry.action.type);
    });
    expect(replayed).toEqual(["create-node"]);
  });
});

describe("YjsDocProvider — §7.1 awareness", () => {
  it("sets and propagates awareness state", () => {
    const p = createYjsDocProvider("room-7");
    p.connect("ws://localhost:1234");
    p.setAwareness({
      user: { id: "peer-1", name: "Alice", color: "blue" },
      cursor: { x: 100, y: 200, pageId: "page-1" },
      selection: { nodeIds: ["n1"], pageId: "page-1" },
    });
    p.onAwarenessChange(() => {});
    p.disconnect();
  });
});
