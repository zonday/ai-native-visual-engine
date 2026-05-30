import { describe, expect, it } from "vitest";
import { HandlerError } from "../src/engine/error.js";
import type { RuntimeAction } from "../src/runtime/actions.js";
import type { DispatchResult } from "../src/runtime/command-bus.js";
import {
  batchInverse,
  computeBatchInverse,
  createBatchHandler,
} from "../src/runtime/handlers/batch.js";
import { createNodeHandler } from "../src/runtime/handlers/create-node.js";
import { removeNodeHandler } from "../src/runtime/handlers/remove-node.js";
import type { SceneGraph } from "../src/types.js";
import { baseNode, emptyScene } from "./helpers.js";

function makeDispatch(initialScene: SceneGraph) {
  let currentScene = initialScene;
  return (action: RuntimeAction): DispatchResult => {
    try {
      if (action.type === "create-node") {
        const newScene = createNodeHandler(currentScene, action, {
          now: Date.now,
        });
        currentScene = newScene;
        return { ok: true, scene: newScene };
      }
      if (action.type === "remove-node") {
        const newScene = removeNodeHandler(currentScene, action, {
          now: Date.now,
        });
        currentScene = newScene;
        return { ok: true, scene: newScene };
      }
      return {
        ok: false,
        scene: currentScene,
        error: {
          code: "scene.unknown-action-type",
          message: "Unknown",
          actionType: action.type,
        },
      };
    } catch (e) {
      if (e instanceof HandlerError) {
        const rawNodeId = e.context.nodeId;
        return {
          ok: false,
          scene: currentScene,
          error: {
            code: e.code,
            message: e.message,
            actionType: action.type,
            nodeId: typeof rawNodeId === "string" ? rawNodeId : undefined,
          },
        };
      }
      return {
        ok: false,
        scene: currentScene,
        error: {
          code: "scene.handler-error",
          message: (e as Error).message,
          actionType: action.type,
        },
      };
    }
  };
}

describe("createBatchHandler", () => {
  it("executes child actions in order and returns the final scene", () => {
    const dispatch = makeDispatch(emptyScene);
    const handler = createBatchHandler(dispatch);

    const batchAction: RuntimeAction = {
      type: "batch-actions",
      actions: [
        { type: "create-node", node: baseNode("a"), parentId: "root" },
        { type: "create-node", node: baseNode("b"), parentId: "root" },
      ],
    };

    const result = handler(emptyScene, batchAction, { now: Date.now });
    expect(result.nodes.a).toBeDefined();
    expect(result.nodes.b).toBeDefined();
    expect(result.nodes.root?.children).toEqual(["a", "b"]);
  });

  it("rolls back entirely when a child action fails", () => {
    const dispatch = makeDispatch(emptyScene);
    const handler = createBatchHandler(dispatch);

    const batchAction: RuntimeAction = {
      type: "batch-actions",
      actions: [
        { type: "create-node", node: baseNode("a"), parentId: "root" },
        { type: "create-node", node: baseNode("a"), parentId: "root" },
      ],
    };

    const result = handler(emptyScene, batchAction, { now: Date.now });
    expect(result).toBe(emptyScene);
  });

  it("flattens nested batch actions before execution", () => {
    const dispatch = makeDispatch(emptyScene);
    const handler = createBatchHandler(dispatch);

    const nestedBatch: RuntimeAction = {
      type: "batch-actions",
      actions: [
        { type: "create-node", node: baseNode("a"), parentId: "root" },
        {
          type: "batch-actions",
          actions: [
            { type: "create-node", node: baseNode("b"), parentId: "root" },
          ],
        },
      ],
    };

    const result = handler(emptyScene, nestedBatch, { now: Date.now });
    expect(result.nodes.a).toBeDefined();
    expect(result.nodes.b).toBeDefined();
  });
});

describe("computeBatchInverse", () => {
  it("returns undefined for an empty batch", () => {
    const dispatch = makeDispatch(emptyScene);
    const batchAction: RuntimeAction = {
      type: "batch-actions",
      actions: [],
    };
    const inverse = computeBatchInverse(
      emptyScene,
      batchAction,
      (_scene, action) => dispatch(action),
      { now: Date.now },
      () => undefined,
    );
    expect(inverse).toBeUndefined();
  });
});

describe("batchInverse", () => {
  it("returns undefined (requires dispatch context)", () => {
    const batchAction: RuntimeAction = {
      type: "batch-actions",
      actions: [{ type: "create-node", node: baseNode("a"), parentId: "root" }],
    };
    const inverse = batchInverse(emptyScene, batchAction, {
      now: Date.now,
    });
    expect(inverse).toBeUndefined();
  });
});
