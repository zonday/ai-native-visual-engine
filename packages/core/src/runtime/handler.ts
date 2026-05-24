import type { Handler, RuntimeContext } from "../engine/handler.js";
import type { SceneGraph } from "../types.js";
import type { RuntimeAction } from "./actions.js";

export type { RuntimeContext };

export type RuntimeHandler<TAction extends RuntimeAction = RuntimeAction> =
  Handler<SceneGraph, TAction, RuntimeContext>;
