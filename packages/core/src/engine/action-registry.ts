import type { Handler, RuntimeContext } from "./handler.js";
import type {
  BatchAction,
  HandlerEntry,
  InverseComputer,
  Validator,
} from "./handler-registry.js";

export interface ActionMeta {
  undoable: boolean;
  mergeable: boolean;
  historyGroup?: string;
  devtoolsLabel?: string;
}

/**
 * HandlerMap is a record type indexed by action type discriminator.
 * Each value pairs the narrow action type (for handler + validate) with
 * the wide action union (for inverse), because inverses commonly produce
 * a different action type than they consume (e.g. create-node → remove-node).
 */
export type HandlerMap<
  TAction extends { type: string },
  TState,
  TContext extends RuntimeContext,
> = {
  [K in TAction["type"]]: {
    handler: Handler<TState, Extract<TAction, { type: K }>, TContext>;
    inverse: InverseComputer<TState, TAction, TContext>;
    validate?: Validator<TState, Extract<TAction, { type: K }>, TContext>;
    meta: ActionMeta;
  };
};

export class ActionRegistry<
  TAction extends { type: string },
  TState,
  TContext extends RuntimeContext,
> {
  private entries = new Map<string, unknown>();

  register(type: string, entry: unknown): void {
    if (this.entries.has(type)) {
      throw new Error(
        `Duplicate handler registration for action type "${type}"`,
      );
    }
    this.entries.set(type, entry);
  }

  getHandler(
    type: TAction["type"],
  ): Handler<TState, TAction, TContext> | undefined {
    return (this.entries.get(type) as Record<string, unknown>)?.handler as
      | Handler<TState, TAction, TContext>
      | undefined;
  }

  getInverse(
    type: TAction["type"],
  ): InverseComputer<TState, TAction, TContext> | undefined {
    return (this.entries.get(type) as Record<string, unknown>)?.inverse as
      | InverseComputer<TState, TAction, TContext>
      | undefined;
  }

  getValidator(
    type: TAction["type"],
  ): Validator<TState, TAction, TContext> | undefined {
    return (this.entries.get(type) as Record<string, unknown>)?.validate as
      | Validator<TState, TAction, TContext>
      | undefined;
  }

  getMeta(type: TAction["type"]): ActionMeta | undefined {
    return (this.entries.get(type) as Record<string, unknown>)?.meta as
      | ActionMeta
      | undefined;
  }

  getEntry(type: TAction["type"]): unknown {
    return this.entries.get(type);
  }

  has(type: string): boolean {
    return this.entries.has(type);
  }

  getAllKeys(): string[] {
    return Array.from(this.entries.keys());
  }

  getAllEntries(): unknown[] {
    return Array.from(this.entries.values());
  }

  createBatchEntry(): HandlerEntry<TState, BatchAction<TAction>, TContext> {
    const self = this;
    return {
      handler(
        state: TState,
        action: BatchAction<TAction>,
        context: TContext,
      ): TState {
        let current = state;
        for (const child of action.actions) {
          const t = (child as TAction).type as TAction["type"];
          const childHandler = self.getHandler(t);
          if (!childHandler) {
            throw new Error(
              `Batch child action "${(child as TAction).type}" has no registered handler`,
            );
          }
          current = childHandler(current, child as never, context);
        }
        return current;
      },
      inverse(
        _stateBefore: TState,
        _action: BatchAction<TAction>,
        _context: TContext,
      ) {
        throw new Error(
          "Batch inverse must be computed by the transaction manager",
        );
      },
      meta: { undoable: true, mergeable: true, devtoolsLabel: "Batch" },
    };
  }
}
