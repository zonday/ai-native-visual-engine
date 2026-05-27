import { describe, it, expect } from "vitest";
import { createYjsDocProvider } from "../src/collaboration/yjs-provider.js";
import { createCollaborationMiddleware } from "../src/collaboration/collaboration-middleware.js";

describe("YjsDocProvider", () => {
  it("creates a shared Y.Doc", () => {
    const provider = createYjsDocProvider("test-room");
    const doc = provider.getDoc();
    expect(doc).toBeDefined();
    expect(doc.clientID).toBeGreaterThanOrEqual(0);
  });

  it("broadcasts and receives actions via shared doc", () => {
    const provider = createYjsDocProvider("room-1");

    let received: unknown = null;
    provider.onRemoteAction((action) => {
      received = action;
    });

    provider.broadcastAction({ type: "test", data: 42 });
    expect(received).toEqual({ type: "test", data: 42 });
  });

  it("sets awareness after connect", () => {
    const provider = createYjsDocProvider("room-2");
    provider.connect("ws://localhost:1234");

    provider.setAwareness({ id: "peer-1", name: "Alice", color: "blue" });

    let peers: unknown = null;
    provider.onAwarenessChange((p) => {
      peers = p;
    });

    provider.onConnectionChange(() => {});
    provider.disconnect();
  });

  it("broadcast does not escape remote lock", () => {
    const provider = createYjsDocProvider("room-3");

    let local = 0;
    provider.onRemoteAction(() => {
      local++;
    });

    provider.broadcastAction({ type: "remote" });
    expect(local).toBe(1);
  });
});

describe("Collaboration middleware", () => {
  it("passes through local actions", () => {
    const provider = createYjsDocProvider("room-4");
    const { middleware, dispose } = createCollaborationMiddleware(provider);

    let called = false;
    const result = middleware(
      { type: "update-style", nodeId: "n1", style: {} } as { type: string },
      {},
      () => {
        called = true;
        return { ok: true, state: {} };
      },
    );

    expect(called).toBe(true);
    expect(result.ok).toBe(true);
    dispose();
  });
});