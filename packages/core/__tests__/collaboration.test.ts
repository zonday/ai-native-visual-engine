import { describe, it, expect } from "vitest";
import { createYjsDocProvider } from "../src/collaboration/yjs-provider.js";
import { createCollaborationMiddleware } from "../src/collaboration/collaboration-middleware.js";
import { createUndoHistoryMiddleware } from "../src/engine/history-middleware.js";
import { createHistoryState } from "../src/engine/history.js";

describe("YjsDocProvider", () => {
  it("broadcasts and receives actions", () => {
    const provider = createYjsDocProvider("room-1");
    let received: unknown = null;
    provider.onRemoteAction((a) => { received = a; });
    provider.broadcastAction({ type: "test", data: 42 });
    expect(received).toEqual({ type: "test", data: 42 });
  });

  it("awareness and connection lifecycle", () => {
    const provider = createYjsDocProvider("room-2");
    provider.connect("ws://localhost:1234");
    provider.setAwareness({ id: "peer-1", name: "Alice" });
    provider.onAwarenessChange(() => {});
    provider.onConnectionChange(() => {});
    provider.disconnect();
  });
});

describe("Undo policy", () => {
  it("clears redo stack on remote action", () => {
    const provider = createYjsDocProvider("room-undo");
    let redoCleared = false;
    createCollaborationMiddleware(provider, {
      clearRedoStack: () => { redoCleared = true; },
    });
    provider.broadcastAction({ type: "remote" });
    expect(redoCleared).toBe(true);
  });

  it("beforeRemoteAction callback fires on remote", () => {
    const provider = createYjsDocProvider("room-before");
    let signaled = false;
    createCollaborationMiddleware(provider, {
      beforeRemoteAction: () => { signaled = true; },
    });
    provider.broadcastAction({ type: "remote" });
    expect(signaled).toBe(true);
  });

  it("shouldExcludeFromUndo prevents undo push for remote actions", () => {
    let exclude = false;
    const history = createHistoryState<{ type: string }>();
    const mw = createUndoHistoryMiddleware(
      () => history,
      () => {},
      () => undefined,
      new Map(),
      () => ({ now: Date.now }) as { now(): number },
      () => exclude,
    );

    mw({ type: "test" } as { type: string }, {}, () => ({ ok: true, state: {} }));
    expect(history.undoStack.length).toBe(0);

    exclude = true;
    mw({ type: "test" } as { type: string }, { modified: true }, () => ({ ok: true, state: {} }));
    expect(history.undoStack.length).toBe(0);
  });
});

describe("Read-only observers", () => {
  it("rejects local mutations in read-only mode", () => {
    const provider = createYjsDocProvider("room-ro");
    const { middleware } = createCollaborationMiddleware(provider, { readonly: true });
    const result = middleware(
      { type: "test" } as { type: string }, {}, () => ({ ok: true, state: {} }),
    );
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("collaboration.readonly");
  });

  it("allows local mutations in normal mode", () => {
    const provider = createYjsDocProvider("room-rw");
    const { middleware } = createCollaborationMiddleware(provider);
    const result = middleware(
      { type: "test" } as { type: string }, {}, () => ({ ok: true, state: {} }),
    );
    expect(result.ok).toBe(true);
  });
});

describe("Convergence", () => {
  it("shared doc converges on action sequence", () => {
    const provider = createYjsDocProvider("converge");

    const actions1: unknown[] = [];
    const actions2: unknown[] = [];

    const unsub1 = provider.onRemoteAction((a) => actions1.push(a));
    const unsub2 = provider.onRemoteAction((a) => actions2.push(a));

    provider.broadcastAction({ type: "a" });
    provider.broadcastAction({ type: "b" });

    expect(actions1.length).toBe(2);
    expect(actions2.length).toBe(2);
    unsub1();
    unsub2();
  });
});

describe("Presence cleanup", () => {
  it("disconnect clears presence", () => {
    const provider = createYjsDocProvider("presence");
    provider.connect("ws://localhost:1234");
    provider.setAwareness({ id: "peer-1" });
    provider.disconnect();
  });
});