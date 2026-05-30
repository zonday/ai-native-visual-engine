import type { ActionMeta } from "./action-registry.js";
import type { Handler, RuntimeContext } from "./handler.js";

export interface BatchAction<
  TAction extends { type: string },
  TType extends string = "batch-actions",
> {
  type: TType;
  actions: TAction[];
}

export type InverseAction<TAction extends { type: string }> =
  | TAction
  | BatchAction<TAction>;

export type InverseComputer<
  TState,
  TAction extends { type: string },
  TContext extends RuntimeContext,
> = (
  stateBefore: Readonly<TState>,
  action: TAction,
  context: TContext,
) => TAction | undefined;

export type Validator<TState, TAction, TContext> = (
  state: Readonly<TState>,
  action: TAction,
  context: TContext,
) => { ok: boolean; error?: { code: string; message: string } };

export interface HandlerEntry<
  TState,
  TAction extends { type: string },
  TContext extends RuntimeContext,
> {
  handler: Handler<TState, TAction, TContext>;
  inverse: InverseComputer<TState, TAction, TContext>;
  validate?: Validator<TState, TAction, TContext>;
  meta: ActionMeta;
}
