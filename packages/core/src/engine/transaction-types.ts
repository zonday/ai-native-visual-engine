export type TransactionSource = "user" | "ai" | "system";

export interface RuntimeTransaction {
  id: string;
  timestamp: number;
  source: TransactionSource;
  actions: unknown[];
  inverseActions?: unknown[];
  affectedNodes: string[];
  metadata?: Record<string, unknown>;
}

export interface TransactionContext<TState, TAction> {
  tx: RuntimeTransaction;
  preState: TState;
  postState?: TState;
  appliedActions: TAction[];
  appliedInverses: TAction[];
}

export interface TransactionResult<TState> {
  ok: boolean;
  state: TState;
  tx: RuntimeTransaction;
  error?: { code: string; message: string; actionType?: string };
}

export const DEFAULT_NESTED_DEPTH_LIMIT = 8;
