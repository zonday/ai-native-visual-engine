import type {
  HandlerEntry,
  HandlerRegistry,
} from "../engine/handler-registry.js";
import type { SceneGraph } from "../types.js";
import type { RuntimeAction } from "./actions.js";
import type { RuntimeContext } from "./handler.js";

export type RuntimeHandlerEntry = HandlerEntry<
  SceneGraph,
  RuntimeAction,
  RuntimeContext
>;

export type RuntimeHandlerRegistry = HandlerRegistry<
  SceneGraph,
  RuntimeAction,
  RuntimeContext
>;

// Return type is the wider RuntimeAction (not TAction) because inverse
// computers often produce a different action type than they consume
// (e.g., create-node inverse returns remove-node).
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
