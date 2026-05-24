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
