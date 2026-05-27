export interface EventLogEntry<TAction> {
  action: TAction;
  actorId?: string;
  timestamp: number;
}

export interface EventLog<TInitialState, TAction> {
  initialState: TInitialState;
  actions: EventLogEntry<TAction>[];
}

export function createEventLog<TInitialState, TAction>(
  initialState: TInitialState,
): EventLog<TInitialState, TAction> {
  return { initialState, actions: [] };
}

export function appendEvent<TInitialState, TAction>(
  log: EventLog<TInitialState, TAction>,
  entry: EventLogEntry<TAction>,
): EventLog<TInitialState, TAction> {
  return { ...log, actions: [...log.actions, entry] };
}

export function replayEvents<TState, TAction extends { type: string }>(
  log: EventLog<TState, TAction>,
  dispatch: (action: TAction) => {
    ok: boolean;
    error?: { message?: string };
  },
  skipActionTypes?: string[],
): void {
  for (const entry of log.actions) {
    if (skipActionTypes?.includes(entry.action.type)) continue;
    const result = dispatch(entry.action);
    if (!result.ok) {
      throw new Error(
        `Replay failed at action ${entry.action.type}: ${result.error?.message}`,
      );
    }
  }
}
