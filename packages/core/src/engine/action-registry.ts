import type { Handler, RuntimeContext } from "./handler.js";
import type {
  BatchAction,
  HandlerEntry,
  InverseComputer,
  Validator,
} from "./handler-registry.js";
import { buildRegistriesFromEntries } from "./handler-registry.js";

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

  register(type: TAction["type"], entry: unknown): void {
    if (this.entries.has(type)) {
      throw new Error(
        `Duplicate handler registration for action type "${type}"`,
      );
    }
    this.entries.set(type, entry);
  }

  getHandler<K extends TAction["type"]>(
    type: K,
  ): HandlerMap<TAction, TState, TContext>[K]["handler"] | undefined {
    return (
      this.entries.get(type) as
        | HandlerMap<TAction, TState, TContext>[K]
        | undefined
    )?.handler;
  }

  getInverse<K extends TAction["type"]>(
    type: K,
  ): HandlerMap<TAction, TState, TContext>[K]["inverse"] | undefined {
    return (
      this.entries.get(type) as
        | HandlerMap<TAction, TState, TContext>[K]
        | undefined
    )?.inverse;
  }

  getValidator<K extends TAction["type"]>(
    type: K,
  ): HandlerMap<TAction, TState, TContext>[K]["validate"] | undefined {
    return (
      this.entries.get(type) as
        | HandlerMap<TAction, TState, TContext>[K]
        | undefined
    )?.validate;
  }

  getMeta<K extends TAction["type"]>(type: K): ActionMeta | undefined {
    return (
      this.entries.get(type) as
        | HandlerMap<TAction, TState, TContext>[K]
        | undefined
    )?.meta;
  }

  getEntry<K extends TAction["type"]>(
    type: K,
  ): HandlerMap<TAction, TState, TContext>[K] | undefined {
    return this.entries.get(type) as
      | HandlerMap<TAction, TState, TContext>[K]
      | undefined;
  }

  has(type: TAction["type"]): boolean {
    return this.entries.has(type);
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

/**
 * Convert an ActionRegistry back to the legacy dual-map form for backward
 * compatibility with consumers that still use handlerRegistry + inverseRegistry.
 */
export function splitRegistry<
  TAction extends { type: string },
  TState,
  TContext extends RuntimeContext,
>(
  registry: ActionRegistry<TAction, TState, TContext>,
): ReturnType<typeof buildRegistriesFromEntries<TState, TAction, TContext>> {
  const entries: [string, HandlerEntry<TState, TAction, TContext>][] = [];

  const typeSet = new Set<string>();
  for (const key of (
    registry as unknown as { entries: Map<string, unknown> }
  ).entries.keys()) {
    typeSet.add(key);
  }

  for (const type of typeSet) {
    const entry = registry.getEntry(type as TAction["type"]);
    if (entry) {
      entries.push([
        type,
        entry as unknown as HandlerEntry<TState, TAction, TContext>,
      ]);
    }
  }

  return buildRegistriesFromEntries(entries);
}
