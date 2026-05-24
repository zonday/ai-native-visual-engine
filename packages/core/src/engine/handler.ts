export interface PluginCapabilities {
  allowsRotation?: boolean;
}

export interface PluginRegistry {
  getCapabilities(nodeType: string): PluginCapabilities | undefined;
}

export interface RuntimeContext {
  now: () => number;
  actorId?: string;
  registry?: PluginRegistry;
}

export type Handler<TState, TAction, TContext extends RuntimeContext> = (
  state: Readonly<TState>,
  action: TAction,
  context: TContext,
) => TState;
