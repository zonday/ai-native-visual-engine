import type { SceneGraph } from "../types.js";
import type { RuntimeAction } from "./actions.js";

export interface RuntimeContext {
  now: () => number;
  actorId?: string;
}

export type RuntimeHandler<TAction extends RuntimeAction> = (
  scene: Readonly<SceneGraph>,
  action: TAction,
  context: RuntimeContext,
) => SceneGraph;
