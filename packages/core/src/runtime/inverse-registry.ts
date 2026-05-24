import type { SceneGraph } from "../types.js";
import type { RuntimeAction } from "./actions.js";
import type { RuntimeContext } from "./handler.js";

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
