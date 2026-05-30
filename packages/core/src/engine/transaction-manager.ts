import type { DispatchResult } from "./command-bus.js";
import type { RuntimeContext } from "./handler.js";
import type { HandlerRegistry } from "./handler-registry.js";
import {
  DEFAULT_NESTED_DEPTH_LIMIT,
  type RuntimeTransaction,
  type TransactionContext,
  type TransactionResult,
  type TransactionSource,
} from "./transaction-types.js";

export type {
  DispatchResult,
  RuntimeTransaction,
  TransactionContext,
  TransactionResult,
  TransactionSource,
};

let transactionCounter = 0;

function generateTxId(source: TransactionSource): string {
  transactionCounter++;
  return `tx-${Date.now()}-${transactionCounter}-${source}`;
}

export interface TransactionManagerConfig<
  TState,
  TAction extends { type: string },
  TContext extends RuntimeContext,
> {
  handlerRegistry: HandlerRegistry<TState, TAction, TContext>;
  computeInverseAction: (
    stateBefore: TState,
    action: TAction,
    context: TContext,
  ) => TAction | undefined;
  dispatch?: (action: TAction) => DispatchResult<TState>;
  validate?: (action: TAction) => {
    ok: boolean;
    error?: { code: string; message: string };
  };
}

export interface ActiveTransaction<TState, TAction, TContext> {
  tx: RuntimeTransaction;
  preState: TState;
  currentState: TState;
  appliedActions: TAction[];
  preActionStates: TState[];
  appliedInverses: TAction[];
  context: TContext;
}

export class TransactionManager<
  TState,
  TAction extends { type: string },
  TContext extends RuntimeContext,
> {
  private config: TransactionManagerConfig<TState, TAction, TContext>;
  private activeStack: ActiveTransaction<TState, TAction, TContext>[] = [];
  private depthLimit: number;

  constructor(
    config: TransactionManagerConfig<TState, TAction, TContext>,
    depthLimit = DEFAULT_NESTED_DEPTH_LIMIT,
  ) {
    this.config = config;
    this.depthLimit = depthLimit;
  }

  get activeDepth(): number {
    return this.activeStack.length;
  }

  getActiveTransaction():
    | ActiveTransaction<TState, TAction, TContext>
    | undefined {
    return this.activeStack[this.activeStack.length - 1];
  }

  begin(
    source: TransactionSource,
    state: TState,
    context: TContext,
    metadata?: Record<string, unknown>,
  ): ActiveTransaction<TState, TAction, TContext> {
    const parentTx =
      this.activeStack.length > 0
        ? this.activeStack[this.activeStack.length - 1]
        : undefined;

    let id: string;
    if (parentTx) {
      const depth = this.activeStack.length;
      if (depth >= this.depthLimit) {
        throw new Error(
          `Nested transaction depth ${depth} exceeds limit ${this.depthLimit}`,
        );
      }
      id = `${parentTx.tx.id}.${depth}`;
    } else {
      id = generateTxId(source);
    }

    const tx: RuntimeTransaction = {
      id,
      timestamp: Date.now(),
      source,
      actions: [],
      affectedNodes: [],
      metadata,
    };

    const active: ActiveTransaction<TState, TAction, TContext> = {
      tx,
      preState: state,
      currentState: state,
      appliedActions: [],
      preActionStates: [],
      appliedInverses: [],
      context,
    };

    this.activeStack.push(active);
    return active;
  }

  applyAction(
    active: ActiveTransaction<TState, TAction, TContext>,
    action: TAction,
  ): {
    ok: boolean;
    error?: { code: string; message: string; actionType?: string };
  } {
    if (this.config.dispatch) {
      active.preActionStates.push(active.currentState);
      const result = this.config.dispatch(action);
      if (result.ok) {
        active.currentState = result.state;
        active.appliedActions.push(action);
        (active.tx.actions as TAction[]).push(action);
        this.collectAffectedNodes(active.tx, action);
      } else {
        active.preActionStates.pop();
      }
      return { ok: result.ok, error: result.error };
    }

    if (this.config.validate) {
      const validationResult = this.config.validate(action);
      if (!validationResult.ok) {
        return {
          ok: false,
          error: {
            code:
              validationResult.error?.code ?? "transaction.validation-failed",
            message:
              validationResult.error?.message ?? "Action validation failed",
            actionType: action.type,
          },
        };
      }
    }

    const entry = this.config.handlerRegistry.get(action.type);
    if (!entry) {
      return {
        ok: false,
        error: {
          code: "unknown-action-type",
          message: `Unknown action type: ${action.type}`,
          actionType: action.type,
        },
      };
    }

    active.preActionStates.push(active.currentState);
    try {
      const newState = entry.handler(
        active.currentState,
        action,
        active.context,
      );
      active.currentState = newState;
      active.appliedActions.push(action);
      (active.tx.actions as TAction[]).push(action);

      this.collectAffectedNodes(active.tx, action);
      return { ok: true };
    } catch (err) {
      active.preActionStates.pop();
      return {
        ok: false,
        error: {
          code:
            err instanceof Error
              ? "transaction.action-failed"
              : "transaction.unknown",
          message: err instanceof Error ? err.message : String(err),
          actionType: action.type,
        },
      };
    }
  }

  private collectAffectedNodes(tx: RuntimeTransaction, action: TAction): void {
    const actionRecord = action as Record<string, unknown>;
    let nodeId = actionRecord.nodeId as string | undefined;
    if (!nodeId && action.type === "create-node") {
      const node = actionRecord.node as { id: string } | undefined;
      nodeId = node?.id;
    }
    if (nodeId && !tx.affectedNodes.includes(nodeId)) {
      tx.affectedNodes.push(nodeId);
    }

    if (action.type === "batch-actions") {
      const children = actionRecord.actions as TAction[] | undefined;
      if (children) {
        for (const child of children) {
          this.collectAffectedNodes(tx, child);
        }
      }
    }
  }

  commit(
    active: ActiveTransaction<TState, TAction, TContext>,
  ): TransactionResult<TState> {
    const top = this.activeStack[this.activeStack.length - 1];
    if (top !== active) {
      return {
        ok: false,
        state: active.currentState,
        tx: active.tx,
        error: {
          code: "transaction.not-top",
          message: "Cannot commit a nested transaction from a parent scope",
        },
      };
    }

    const inverses: TAction[] = [];
    for (let i = active.appliedActions.length - 1; i >= 0; i--) {
      const action = active.appliedActions[i];
      if (action && action.type !== "update-selection") {
        const inv = this.computeInverse(active, action, i);
        if (inv) {
          inverses.push(inv);
        }
      }
    }
    active.appliedInverses = inverses;
    active.tx.inverseActions = inverses;

    this.activeStack.pop();

    return {
      ok: true,
      state: active.currentState,
      tx: active.tx,
    };
  }

  rollback(active: ActiveTransaction<TState, TAction, TContext>): TState {
    const top = this.activeStack[this.activeStack.length - 1];
    if (top === active) {
      this.activeStack.pop();
    }
    return active.preState;
  }

  private computeInverse(
    active: ActiveTransaction<TState, TAction, TContext>,
    action: TAction,
    actionIndex: number,
  ): TAction | undefined {
    try {
      const stateBefore =
        active.preActionStates[actionIndex] ?? active.preState;
      return this.config.computeInverseAction(
        stateBefore,
        action,
        active.context,
      );
    } catch (err) {
      console.warn("[transaction] inverse computation failed:", err);
      return undefined;
    }
  }
}
