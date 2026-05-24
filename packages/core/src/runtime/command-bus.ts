import type { SceneGraph } from "../types.js";
import type { RuntimeAction } from "./actions.js";

export interface DispatchResult {
  ok: boolean;
  scene: SceneGraph;
  error?: RuntimeError;
}

export interface RuntimeError {
  code: string;
  message: string;
  actionType?: string;
  nodeId?: string;
}

export type CommandBus = {
  dispatch(action: RuntimeAction): DispatchResult;
};
