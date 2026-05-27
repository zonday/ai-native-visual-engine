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

  it("broadcasts and receives actions", () => {
    const provider = createYjsDocProvider("room-1");
    let received: unknown = null;
    provider.onRemoteAction((a) => { received = a; });
    provider.broadcastAction({ type: "test", data: 42 });
    expect(received).toEqual({ type: "test", data: 42 });
  });

  it("awareness set and get", () => {
    const provider = createYjsDocProvider("room-2");
    provider.connect("ws://localhost:1234");
    provider.setAwareness({ id: "peer-1", name: "Alice", color: "blue" });
    provider.onAwarenessChange(() => {});
    provider.onConnectionChange(() => {});
    provider.disconnect();
  });
});

describe("Collaboration middleware — undo policy", () => {
  it("clears redo stack on remote action", () => {
    const provider = createYjsDocProvider("room-undo");
    let redoCleared = false;

    createCollaborationMiddleware(provider, {
      clearRedoStack: () => { redoCleared = true; },
    });

    provider.broadcastAction({ type: "remote" });
    expect(redoCleared).toBe(true);
  });

  it("notifies onRemoteAction callback", () => {
    const provider = createYjsDocProvider("room-notify");
    let count = 0;

    createCollaborationMiddleware(provider, {
      onRemoteAction: () => { count++; },
    });

    provider.broadcastAction({ type: "remote" });
    expect(count).toBe(1);
  });
});

describe("Collaboration middleware — read-only", () => {
  it("rejects local mutations", () => {
    const provider = createYjsDocProvider("room-ro");
    const { middleware } = createCollaborationMiddleware(provider, { readonly: true });

    const result = middleware(
      { type: "test" } as { type: string },
      {},
      () => ({ ok: true, state: {} }),
    );
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("collaboration.readonly");
  });

  it("broadcasts local actions when not readonly", () => {
    const provider = createYjsDocProvider("room-rw");
    const { middleware } = createCollaborationMiddleware(provider);

    const result = middleware(
      { type: "test" } as { type: string },
      {},
      () => ({ ok: true, state: {} }),
    );
    expect(result.ok).toBe(true);
  });
});