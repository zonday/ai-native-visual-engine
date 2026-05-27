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
  active: string[],
  stateProps: Map<string, Record<string, unknown>>,
): Record<string, unknown> {
  let resolved: Record<string, unknown> = {};
  for (const stateName of active) {
    const props = stateProps.get(stateName);
    if (props) {
      resolved = { ...resolved, ...props };
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
