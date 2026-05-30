import type { Handler, RuntimeContext } from "./handler.js";
import type { InverseComputer } from "./handler-registry.js";

export interface ActionMeta {
  undoable: boolean;
  mergeable: boolean;
  historyGroup?: string;
  devtoolsLabel?: string;
}

export type Validator<TState, TAction, TContext> = (
  state: Readonly<TState>,
  action: TAction,
  context: TContext,
) => { ok: boolean; error?: { code: string; message: string } };

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

  register<K extends TAction["type"]>(
    type: K,
    entry: HandlerMap<TAction, TState, TContext>[K],
  ): void {
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
      this.entries.get(type) as HandlerMap<TAction, TState, TContext>[K] | undefined
    )?.handler;
  }

  getInverse<K extends TAction["type"]>(
    type: K,
  ): HandlerMap<TAction, TState, TContext>[K]["inverse"] | undefined {
    return (
      this.entries.get(type) as HandlerMap<TAction, TState, TContext>[K] | undefined
    )?.inverse;
  }

  getValidator<K extends TAction["type"]>(
    type: K,
  ): HandlerMap<TAction, TState, TContext>[K]["validate"] | undefined {
    return (
      this.entries.get(type) as HandlerMap<TAction, TState, TContext>[K] | undefined
    )?.validate;
  }

  getMeta<K extends TAction["type"]>(type: K): ActionMeta | undefined {
    return (
      this.entries.get(type) as HandlerMap<TAction, TState, TContext>[K] | undefined
    )?.meta;
  }

  getEntry<K extends TAction["type"]>(
    type: K,
  ): HandlerMap<TAction, TState, TContext>[K] | undefined {
    return this.entries.get(type) as HandlerMap<TAction, TState, TContext>[K] | undefined;
  }

  has(type: TAction["type"]): boolean {
    return this.entries.has(type);
  }
}
