import type { Handler, RuntimeContext } from "../engine/handler.js";
import type {
  HandlerEntry,
  HandlerRegistry as EngineHandlerRegistry,
} from "../engine/handler-registry.js";
import type { ActionRegistry, HandlerMap } from "../engine/action-registry.js";
import type { SceneGraph } from "../types.js";
import type { RuntimeAction } from "./actions.js";

export type { RuntimeContext, ActionRegistry, HandlerMap };

export type RuntimeHandler<TAction extends RuntimeAction = RuntimeAction> =
  Handler<SceneGraph, TAction, RuntimeContext>;

export type RuntimeHandlerEntry = HandlerEntry<
  SceneGraph,
  RuntimeAction,
  RuntimeContext
>;

export type RuntimeHandlerRegistry = EngineHandlerRegistry<
  SceneGraph,
  RuntimeAction,
  RuntimeContext
>;

export type InverseComputer<TAction extends RuntimeAction = RuntimeAction> = (
  sceneBefore: SceneGraph,
  action: TAction,
  context: RuntimeContext,
) => RuntimeAction | undefined;

export type InverseRegistry = Map<string, InverseComputer>;

export function createInverseRegistry(
  computers: Record<string, InverseComputer>,
): InverseRegistry {
  return new Map(Object.entries(computers));
}

export function computeInverseAction(
  registry: InverseRegistry,
  sceneBefore: SceneGraph,
  action: RuntimeAction,
  context: RuntimeContext,
): RuntimeAction | undefined {
  const computer = registry.get(action.type);
  if (!computer) return undefined;
  return computer(sceneBefore, action, context);
}

export type RuntimeEntryFor<K extends RuntimeAction["type"]> =
  HandlerMap<RuntimeAction, SceneGraph, RuntimeContext>[K];

export const STANDARD_ACTION_META = {
  undoable: true,
  mergeable: false,
} as const;
