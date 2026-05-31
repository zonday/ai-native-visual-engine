import { describe, expect, it } from "vitest";
import { ActionRegistry } from "../src/engine/action-registry.js";
import type { DispatchResult } from "../src/engine/command-bus.js";
import type { RuntimeContext } from "../src/engine/handler.js";
import { TransactionManager } from "../src/engine/transaction.js";

interface TestAction {
  type: string;
  nodeId?: string;
  value?: string;
}

interface TestState {
  nodes: Record<string, { id: string; value: string }>;
  version: number;
}

function makeActionRegistry(
  entries: [string, (state: TestState, action: TestAction) => TestState][],
  inverses?: [
    string,
    (state: TestState, action: TestAction) => TestAction | undefined,
  ][],
): ActionRegistry<TestAction, TestState, RuntimeContext> {
  const inverseMap = new Map(inverses ?? []);
  const registry = new ActionRegistry<TestAction, TestState, RuntimeContext>();
  for (const [type, handler] of entries) {
    const inv = inverseMap.get(type);
    registry.register(type, {
      handler,
      inverse: inv
        ? (state: TestState, action: TestAction, _ctx: RuntimeContext) =>
            inv(state, action)
        : undefined,
      meta: { undoable: true, mergeable: false, devtoolsLabel: "" },
    });
  }
  return registry;
}

const testContext: RuntimeContext = { now: () => Date.now() };

function emptyState(): TestState {
  return { nodes: {}, version: 0 };
}

const defaultRegistry = makeActionRegistry(
  [
    [
      "set-value",
      (state, action) => {
        const nodeId = action.nodeId ?? "unknown";
        return {
          ...state,
          nodes: {
            ...state.nodes,
            [nodeId]: { id: nodeId, value: action.value ?? "" },
          },
          version: state.version + 1,
        };
      },
    ],
    [
      "create-node",
      (state, action) => {
        const nodeId = action.nodeId ?? "new-node";
        return {
          ...state,
          nodes: {
            ...state.nodes,
            [nodeId]: { id: nodeId, value: action.value ?? "new" },
          },
          version: state.version + 1,
        };
      },
    ],
    [
      "remove-node",
      (state, action) => {
        const nodeId = action.nodeId ?? "";
        if (!nodeId || !state.nodes[nodeId]) return state;
        const next = { ...state.nodes };
        delete next[nodeId];
        return { ...state, nodes: next, version: state.version + 1 };
      },
    ],
    ["update-selection", (state) => state],
  ],
  [
    [
      "set-value",
      (stateBefore, action) => {
        const nodeId = action.nodeId ?? "unknown";
        const prev = stateBefore.nodes[nodeId];
        return {
          type: "set-value",
          nodeId,
          value: prev?.value ?? "",
        };
      },
    ],
    ["create-node", (_stateBefore) => undefined],
    [
      "remove-node",
      (stateBefore, action) => {
        const nodeId = action.nodeId ?? "";
        const prev = stateBefore.nodes[nodeId];
        if (!prev) return undefined;
        return {
          type: "create-node",
          nodeId: prev.id,
          value: prev.value,
        };
      },
    ],
  ],
);

function createDefaultTM() {
  return new TransactionManager({ registry: defaultRegistry });
}

describe("TransactionManager", () => {
  describe("begin", () => {
    it("creates a transaction with the given source", () => {
      const tm = createDefaultTM();
      const active = tm.begin("user", emptyState(), testContext);
      expect(active.tx.source).toBe("user");
      expect(active.tx.actions).toEqual([]);
      expect(active.tx.affectedNodes).toEqual([]);
      expect(active.preState).toEqual(emptyState());
      expect(active.currentState).toEqual(emptyState());
    });

    it("creates nested transactions with depth-limited IDs", () => {
      const tm = createDefaultTM();
      const parent = tm.begin("user", emptyState(), testContext);
      const child = tm.begin("ai", emptyState(), testContext);
      expect(child.tx.id).toContain(parent.tx.id);
      expect(child.tx.source).toBe("ai");
    });

    it("throws when nested depth exceeds limit", () => {
      const _tm = createDefaultTM();
      const depthLimit = 1;
      const tmWithLimit = new TransactionManager(
        { registry: defaultRegistry },
        depthLimit,
      );
      tmWithLimit.begin("user", emptyState(), testContext);
      expect(() => tmWithLimit.begin("ai", emptyState(), testContext)).toThrow(
        "Nested transaction depth",
      );
    });
  });

  describe("applyAction via handler registry", () => {
    it("applies action to current state and records it", () => {
      const tm = createDefaultTM();
      const active = tm.begin("user", emptyState(), testContext);

      const result = tm.applyAction(active, {
        type: "set-value",
        nodeId: "n1",
        value: "hello",
      });

      expect(result.ok).toBe(true);
      expect(active.currentState.nodes.n1?.value).toBe("hello");
      expect(active.tx.actions).toHaveLength(1);
      expect(active.appliedActions).toHaveLength(1);
    });

    it("rejects unknown action types", () => {
      const tm = createDefaultTM();
      const active = tm.begin("user", emptyState(), testContext);

      const result = tm.applyAction(active, { type: "nonexistent" });

      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe("unknown-action-type");
    });

    it("applies multiple actions sequentially", () => {
      const tm = createDefaultTM();
      const active = tm.begin("user", emptyState(), testContext);

      tm.applyAction(active, {
        type: "set-value",
        nodeId: "n1",
        value: "first",
      });
      tm.applyAction(active, {
        type: "set-value",
        nodeId: "n2",
        value: "second",
      });

      expect(active.currentState.nodes.n1?.value).toBe("first");
      expect(active.currentState.nodes.n2?.value).toBe("second");
      expect(active.appliedActions).toHaveLength(2);
    });

    it("runs validation when validate config is provided", () => {
      const tm = new TransactionManager({
        registry: defaultRegistry,
        validate: (action) => {
          if (action.type === "set-value" && !action.nodeId) {
            return {
              ok: false,
              error: {
                code: "validation.missing-node-id",
                message: "nodeId required",
              },
            };
          }
          return { ok: true };
        },
      });
      const active = tm.begin("user", emptyState(), testContext);

      const passResult = tm.applyAction(active, {
        type: "set-value",
        nodeId: "n1",
        value: "ok",
      });
      expect(passResult.ok).toBe(true);

      const failResult = tm.applyAction(active, {
        type: "set-value",
        value: "bad",
      });
      expect(failResult.ok).toBe(false);
      expect(failResult.error?.code).toBe("validation.missing-node-id");
    });
  });

  describe("applyAction via dispatch function", () => {
    it("dispatches through the provided function and syncs state", () => {
      const dispatched: TestAction[] = [];
      const dispatchFn = (action: TestAction): DispatchResult<TestState> => {
        dispatched.push(action);
        return {
          ok: true,
          state: {
            nodes: { n1: { id: "n1", value: "via-dispatch" } },
            version: 1,
          },
        };
      };

      const tm = new TransactionManager({
        registry: defaultRegistry,
        dispatch: dispatchFn,
      });

      const active = tm.begin("user", emptyState(), testContext);
      const result = tm.applyAction(active, {
        type: "set-value",
        nodeId: "n1",
        value: "via-dispatch",
      });

      expect(result.ok).toBe(true);
      expect(active.currentState.nodes.n1?.value).toBe("via-dispatch");
      expect(active.appliedActions).toHaveLength(1);
      expect(dispatched).toHaveLength(1);
    });

    it("propagates dispatch failure", () => {
      const dispatchFn = (): DispatchResult<TestState> => ({
        ok: false,
        state: { nodes: {}, version: 0 },
        error: { code: "scene.node-not-found", message: "not found" },
      });

      const tm = new TransactionManager({
        registry: defaultRegistry,
        dispatch: dispatchFn,
      });

      const active = tm.begin("user", emptyState(), testContext);
      const result = tm.applyAction(active, {
        type: "remove-node",
        nodeId: "missing",
      });

      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe("scene.node-not-found");
      expect(active.appliedActions).toHaveLength(0);
    });
  });

  describe("commit", () => {
    it("computes and stores inverse actions in LIFO order", () => {
      const tm = createDefaultTM();
      const state = emptyState();
      const active = tm.begin("user", state, testContext);

      tm.applyAction(active, { type: "set-value", nodeId: "n1", value: "a" });
      tm.applyAction(active, { type: "set-value", nodeId: "n1", value: "b" });

      const result = tm.commit(active);

      expect(result.ok).toBe(true);
      expect(active.tx.inverseActions).toHaveLength(2);
      expect((active.tx.inverseActions?.[0] as TestAction).value).toBe("a");
      expect((active.tx.inverseActions?.[1] as TestAction).value).toBe("");
      expect(active.appliedInverses).toEqual(active.tx.inverseActions);
    });

    it("rejects commit when active is not top of stack", () => {
      const tm = createDefaultTM();
      const parent = tm.begin("user", emptyState(), testContext);
      const _child = tm.begin("ai", emptyState(), testContext);

      const result = tm.commit(parent);

      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe("transaction.not-top");
      expect(tm.activeDepth).toBe(2);
    });

    it("excludes update-selection from inverses", () => {
      const tm = createDefaultTM();
      const active = tm.begin("user", emptyState(), testContext);

      tm.applyAction(active, { type: "set-value", nodeId: "n1", value: "a" });
      tm.applyAction(active, { type: "update-selection" });

      const result = tm.commit(active);

      expect(result.ok).toBe(true);
      const invTypes = ((active.tx.inverseActions ?? []) as TestAction[]).map(
        (a) => a.type,
      );
      expect(invTypes).not.toContain("update-selection");
      expect(active.appliedActions).toHaveLength(2);
    });

    it("pop transaction from active stack on commit", () => {
      const tm = createDefaultTM();
      const active = tm.begin("user", emptyState(), testContext);
      expect(tm.activeDepth).toBe(1);

      tm.commit(active);

      expect(tm.activeDepth).toBe(0);
      expect(tm.getActiveTransaction()).toBeUndefined();
    });
  });

  describe("rollback", () => {
    it("returns preState for caller to restore", () => {
      const tm = createDefaultTM();
      const state = emptyState();
      const active = tm.begin("user", state, testContext);

      tm.applyAction(active, {
        type: "set-value",
        nodeId: "n1",
        value: "hello",
      });
      const preState = tm.rollback(active);

      expect(preState).toEqual(emptyState());
    });

    it("pops transaction from active stack on rollback", () => {
      const tm = createDefaultTM();
      const active = tm.begin("user", emptyState(), testContext);
      expect(tm.activeDepth).toBe(1);

      tm.rollback(active);

      expect(tm.activeDepth).toBe(0);
    });
  });

  describe("collectAffectedNodes", () => {
    it("tracks nodeId from standard actions", () => {
      const tm = createDefaultTM();
      const active = tm.begin("user", emptyState(), testContext);

      tm.applyAction(active, { type: "set-value", nodeId: "n1", value: "a" });
      tm.applyAction(active, { type: "set-value", nodeId: "n2", value: "b" });

      expect(active.tx.affectedNodes).toEqual(["n1", "n2"]);
    });

    it("tracks nodeId from create-node actions", () => {
      const tm = createDefaultTM();
      const active = tm.begin("user", emptyState(), testContext);

      tm.applyAction(active, {
        type: "create-node",
        nodeId: "new-1",
        value: "new",
      });

      expect(active.tx.affectedNodes).toContain("new-1");
    });

    it("tracks nodeId from create-node with node.id shape", () => {
      const tm = createDefaultTM();
      const active = tm.begin("user", emptyState(), testContext);

      tm.applyAction(active, {
        type: "create-node",
        node: { id: "node-from-object" },
      } as TestAction);

      expect(active.tx.affectedNodes).toContain("node-from-object");
    });
  });

  describe("activeDepth and getActiveTransaction", () => {
    it("starts at depth 0 with no active transaction", () => {
      const tm = createDefaultTM();
      expect(tm.activeDepth).toBe(0);
      expect(tm.getActiveTransaction()).toBeUndefined();
    });

    it("increments depth with nested transactions", () => {
      const tm = createDefaultTM();
      tm.begin("user", emptyState(), testContext);
      expect(tm.activeDepth).toBe(1);

      tm.begin("ai", emptyState(), testContext);
      expect(tm.activeDepth).toBe(2);
    });

    it("getActiveTransaction returns the innermost active", () => {
      const tm = createDefaultTM();
      const outer = tm.begin("user", emptyState(), testContext);
      tm.begin("ai", emptyState(), testContext);

      const active = tm.getActiveTransaction();
      expect(active?.tx.source).toBe("ai");
      expect(active).not.toBe(outer);
    });
  });

  describe("round-trip: begin → apply → commit", () => {
    it("produces replayable inverse actions", () => {
      const tm = createDefaultTM();
      const initialState = emptyState();
      const active = tm.begin("user", initialState, testContext);

      tm.applyAction(active, {
        type: "set-value",
        nodeId: "n1",
        value: "hello",
      });
      const commitResult = tm.commit(active);

      expect(commitResult.state.nodes.n1?.value).toBe("hello");

      const inverses = commitResult.tx.inverseActions ?? [];
      expect(inverses).toHaveLength(1);

      let replayed = commitResult.state;
      for (const inv of inverses) {
        const handler = defaultRegistry.getHandler(
          (inv as TestAction).type as TestAction["type"],
        );
        if (handler) {
          replayed = handler(replayed, inv as TestAction, testContext);
        }
      }
      expect(replayed.nodes.n1?.value).toBe("");
    });
  });
});
