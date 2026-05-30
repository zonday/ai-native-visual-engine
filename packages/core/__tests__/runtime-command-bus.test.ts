import { describe, expect, it } from "vitest";
import type { Middleware } from "../src/engine/command-bus.js";
import type { RuntimeAction } from "../src/runtime/actions.js";
import type { RuntimeHandlerEntry } from "../src/runtime/handler-registry.js";
import { createDefaultRuntimeRegistries } from "../src/runtime/inverse.js";
import { createRuntimeCommandBus } from "../src/runtime/runtime-command-bus.js";
import type { SceneGraph } from "../src/types.js";

type RuntimeMiddleware = Middleware<SceneGraph, RuntimeAction>;

import { baseNode, emptyScene } from "./helpers.js";

describe("createRuntimeCommandBus", () => {
  it("dispatches a valid action and returns ok with updated scene", () => {
    const { handlerRegistry } = createDefaultRuntimeRegistries(() => ({
      ok: false,
      scene: emptyScene,
      error: { code: "scene.handler-error", message: "should not be called" },
    }));
    const bus = createRuntimeCommandBus(handlerRegistry, [], emptyScene, {
      now: Date.now,
    });

    const action: RuntimeAction = {
      type: "create-node",
      node: baseNode("child-1"),
      parentId: "root",
    };

    const result = bus.dispatch(action);
    expect(result.ok).toBe(true);
    expect(result.scene.nodes["child-1"]).toBeDefined();
    expect(result.scene.nodes.root?.children).toEqual(["child-1"]);
  });

  it("returns unknown-action-type error for unregistered action type", () => {
    const { handlerRegistry } = createDefaultRuntimeRegistries(() => ({
      ok: false,
      scene: emptyScene,
      error: { code: "scene.handler-error", message: "should not be called" },
    }));
    const bus = createRuntimeCommandBus(handlerRegistry, [], emptyScene, {
      now: Date.now,
    });

    const action = {
      type: "nonexistent",
      foo: "bar",
    } as unknown as RuntimeAction;
    const result = bus.dispatch(action);

    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("unknown-action-type");
    expect(result.error?.actionType).toBe("nonexistent");
  });

  it("returns handler error code when RuntimeHandlerError is thrown", () => {
    const { handlerRegistry } = createDefaultRuntimeRegistries(() => ({
      ok: false,
      scene: emptyScene,
      error: { code: "scene.handler-error", message: "should not be called" },
    }));
    const bus = createRuntimeCommandBus(handlerRegistry, [], emptyScene, {
      now: Date.now,
    });

    const action: RuntimeAction = {
      type: "create-node",
      node: baseNode("root"),
      parentId: "root",
    };

    const result = bus.dispatch(action);
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("scene.duplicate-node-id");
  });

  it("returns handler-error for unknown exceptions thrown from handler", () => {
    const throwingHandler = new Map<string, RuntimeHandlerEntry>([
      [
        "test-action",
        {
          handler: () => {
            throw new Error("Kaboom!");
          },
          inverse: () => undefined,
          meta: { undoable: true, mergeable: false, devtoolsLabel: "" },
        } as RuntimeHandlerEntry,
      ],
    ]);

    const bus = createRuntimeCommandBus(throwingHandler, [], emptyScene, {
      now: Date.now,
    });

    const result = bus.dispatch({
      type: "test-action",
    } as unknown as RuntimeAction);
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("handler-error");
    expect(result.error?.message).toBe("Kaboom!");
  });

  it("returns middleware-error when middleware chain is broken", () => {
    const { handlerRegistry } = createDefaultRuntimeRegistries(() => ({
      ok: false,
      scene: emptyScene,
      error: { code: "scene.handler-error", message: "should not be called" },
    }));
    const bus = createRuntimeCommandBus(
      handlerRegistry,
      [undefined as unknown as RuntimeMiddleware],
      emptyScene,
      { now: Date.now },
    );

    const action: RuntimeAction = {
      type: "create-node",
      node: baseNode("child-1"),
      parentId: "root",
    };

    const result = bus.dispatch(action);
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("middleware-error");
  });

  it("runs middleware pipeline before handler and passes modified scene", () => {
    const { handlerRegistry } = createDefaultRuntimeRegistries(() => ({
      ok: false,
      scene: emptyScene,
      error: { code: "scene.handler-error", message: "should not be called" },
    }));
    let middlewareCalled = false;
    const trackingMiddleware: RuntimeMiddleware = (_action, _scene, next) => {
      middlewareCalled = true;
      return next();
    };
    const bus = createRuntimeCommandBus(
      handlerRegistry,
      [trackingMiddleware],
      emptyScene,
      { now: Date.now },
    );

    const action: RuntimeAction = {
      type: "create-node",
      node: baseNode("child-1"),
      parentId: "root",
    };

    const result = bus.dispatch(action);
    expect(result.ok).toBe(true);
    expect(middlewareCalled).toBe(true);
  });

  it("getScene returns the current scene", () => {
    const { handlerRegistry } = createDefaultRuntimeRegistries(() => ({
      ok: false,
      scene: emptyScene,
      error: { code: "scene.handler-error", message: "should not be called" },
    }));
    const bus = createRuntimeCommandBus(handlerRegistry, [], emptyScene, {
      now: Date.now,
    });

    const scene = bus.getScene();
    expect(scene).toBe(emptyScene);
  });
});
