export const DEFAULT_MAX_UNDO_STACK = 200;

export interface HistoryEntry<TAction> {
	action: TAction;
	actions?: TAction[];
	inverseAction?: TAction;
	inverseActions?: TAction[];
	timestamp: number;
	actorId?: string;
}

export interface HistoryState<TAction> {
	undoStack: HistoryEntry<TAction>[];
	redoStack: HistoryEntry<TAction>[];
	checkpointIndex?: number;
}

export function createHistoryState<TAction>(): HistoryState<TAction> {
	return { undoStack: [], redoStack: [] };
}

export function pushUndo<TAction>(
	state: HistoryState<TAction>,
	entry: HistoryEntry<TAction>,
	maxStackSize = DEFAULT_MAX_UNDO_STACK,
): HistoryState<TAction> {
	const undoStack = [...state.undoStack, entry];
	const trimmed =
		undoStack.length > maxStackSize
			? undoStack.slice(undoStack.length - maxStackSize)
			: undoStack;
	return {
		undoStack: trimmed,
		redoStack: [],
		checkpointIndex: state.checkpointIndex,
	};
}

export function pushUndoTransaction<TAction>(
	state: HistoryState<TAction>,
	actions: TAction[],
	inverseActions: TAction[],
	timestamp: number,
	actorId?: string,
	maxStackSize = DEFAULT_MAX_UNDO_STACK,
): HistoryState<TAction> {
	if (actions.length === 0) return state;
	const entry: HistoryEntry<TAction> = {
		action: actions[0] as TAction,
		actions,
		inverseActions,
		timestamp,
		actorId,
	};
	return pushUndo(state, entry, maxStackSize);
}

export function setCheckpoint<TAction>(
	state: HistoryState<TAction>,
): HistoryState<TAction> {
	return { ...state, checkpointIndex: state.undoStack.length };
}

export function clearCheckpoint<TAction>(
	state: HistoryState<TAction>,
): HistoryState<TAction> {
	return { ...state, checkpointIndex: undefined };
}

export function undoAction<TAction>(state: HistoryState<TAction>): {
	state: HistoryState<TAction>;
	inverseAction: TAction;
	inverseActions: TAction[];
} | null {
	if (state.undoStack.length === 0) return null;

	// Stop at checkpoint
	if (
		state.checkpointIndex !== undefined &&
		state.undoStack.length <= state.checkpointIndex
	) {
		return null;
	}

	const entry = state.undoStack[state.undoStack.length - 1];
	if (!entry) return null;

	const inverses =
		entry.inverseActions ?? (entry.inverseAction ? [entry.inverseAction] : []);
	if (inverses.length === 0) return null;

	return {
		state: {
			undoStack: state.undoStack.slice(0, -1),
			redoStack: [...state.redoStack, entry],
			checkpointIndex: state.checkpointIndex,
		},
		inverseAction: inverses[0] as TAction,
		inverseActions: inverses,
	};
}

export function redoAction<TAction>(state: HistoryState<TAction>): {
	state: HistoryState<TAction>;
	action: TAction;
	actions: TAction[];
} | null {
	if (state.redoStack.length === 0) return null;

	const entry = state.redoStack[state.redoStack.length - 1];
	if (!entry) return null;

	const actions = entry.actions ?? (entry.action ? [entry.action] : []);
	if (actions.length === 0) return null;

	return {
		state: {
			undoStack: [...state.undoStack, entry],
			redoStack: state.redoStack.slice(0, -1),
			checkpointIndex: state.checkpointIndex,
		},
		action: actions[0] as TAction,
		actions,
	};
}

export function replayActions<TAction>(
	entries: HistoryEntry<TAction>[],
	dispatch: (action: TAction) => { ok: boolean },
): { ok: boolean; failedAt?: number } {
	for (let i = 0; i < entries.length; i++) {
		const entry = entries[i];
		if (!entry) continue;
		const actions = entry.actions ?? (entry.action ? [entry.action] : []);
		for (const action of actions) {
			const result = dispatch(action);
			if (!result.ok) {
				return { ok: false, failedAt: i };
			}
		}
	}
	return { ok: true };
}

export interface HistorySnapshot<TAction> {
	undoStack: HistoryEntry<TAction>[];
	redoStack: HistoryEntry<TAction>[];
	checkpointIndex?: number;
}
