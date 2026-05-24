export interface RuntimeContext {
  now: () => number;
  actorId?: string;
}

export type Handler<TState, TAction, TContext extends RuntimeContext> = (
  state: Readonly<TState>,
  action: TAction,
  context: TContext,
) => TState;
