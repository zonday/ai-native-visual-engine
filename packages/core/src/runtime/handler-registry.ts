import type { ActionRegistry, HandlerMap } from "../engine/action-registry.js";
import type { Handler, RuntimeContext } from "../engine/handler.js";
import type { HandlerEntry } from "../engine/handler-registry.js";
import type { SceneGraph } from "../types.js";
import type { RuntimeAction } from "./register-handlers.js";

export type { ActionRegistry, HandlerMap, RuntimeContext };

export type RuntimeHandler<TAction extends RuntimeAction = RuntimeAction> =
  Handler<SceneGraph, TAction, RuntimeContext>;

export type RuntimeHandlerEntry = HandlerEntry<
  SceneGraph,
  RuntimeAction,
  RuntimeContext
>;

export type InverseComputer<TAction extends RuntimeAction = RuntimeAction> = (
  sceneBefore: SceneGraph,
  action: TAction,
  context: RuntimeContext,
) => RuntimeAction | undefined;
