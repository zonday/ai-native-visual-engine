import type { SceneNode } from "./types.js";

export interface ComponentStateDef {
  name: string;
  props: Record<string, unknown>;
  exclusiveGroup?: string;
  persisted?: boolean;
}

export interface ComponentStatesConfig {
  states: ComponentStateDef[];
}

export function resolveStateProps(
  node: SceneNode,
  config: ComponentStatesConfig,
): Record<string, unknown> {
  const active = node.activeStates ?? [];
  let resolved: Record<string, unknown> = {};

  for (const stateName of active) {
    const stateDef = config.states.find((s) => s.name === stateName);
    if (stateDef) {
      resolved = { ...resolved, ...stateDef.props };
    }
  }

  return resolved;
}

export interface StateAPI {
  setState(nodeId: string, state: string): void;
  clearState(nodeId: string, state: string): void;
  setExclusive(nodeId: string, state: string, group: string): void;
  getActiveStates(nodeId: string): string[];
}
