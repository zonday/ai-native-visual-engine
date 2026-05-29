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
  skipActionTypes?: readonly string[],
): void {
  const skipSet = skipActionTypes ? new Set(skipActionTypes) : undefined;
  for (const entry of log.actions) {
    if (skipSet?.has(entry.action.type)) continue;
    let result: { ok: boolean; error?: { message?: string } };
    try {
      result = dispatch(entry.action);
    } catch (err) {
      throw new Error(
        `Replay threw at action ${entry.action.type}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    if (!result.ok) {
      throw new Error(
        `Replay failed at action ${entry.action.type}: ${result.error?.message}`,
      );
    }
  }
}
