import type { SceneGraph } from "../types.js";
import type { RuntimeAction } from "./actions.js";
import type { DispatchResult } from "./command-bus.js";

export type RuntimeMiddleware = (
  action: RuntimeAction,
  scene: SceneGraph,
  next: () => DispatchResult,
) => DispatchResult;
