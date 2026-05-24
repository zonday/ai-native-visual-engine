import type { SceneGraph } from "../types.js";
import type { RuntimeAction } from "./actions.js";
import type { EngineError, ErrorDomain, ErrorSeverity } from "../engine/error.js";

export interface DispatchResult {
  ok: boolean;
  scene: SceneGraph;
  error?: RuntimeError;
}

export interface RuntimeError extends EngineError {
  domain: "scene";
  actionType?: string;
  nodeId?: string;
}

export type CommandBus = {
  dispatch(action: RuntimeAction): DispatchResult;
};
