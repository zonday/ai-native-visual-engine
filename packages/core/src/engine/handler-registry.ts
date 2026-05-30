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

export type InverseRegistry<TAction extends { type: string }> = Map<
  string,
  InverseComputer<unknown, TAction, RuntimeContext>
>;

export function createInverseRegistry<TAction extends { type: string }>(
  computers: Record<string, InverseComputer<unknown, TAction, RuntimeContext>>,
): InverseRegistry<TAction> {
  return new Map(Object.entries(computers));
}

export function computeInverseAction<TState, TAction extends { type: string }>(
  registry: InverseRegistry<TAction>,
  stateBefore: TState,
  action: TAction,
  context: RuntimeContext,
): TAction | undefined {
  const computer = registry.get(action.type);
  if (!computer) return undefined;
  return computer(
    stateBefore as unknown as Readonly<unknown>,
    action,
    context,
  ) as TAction | undefined;
}

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

export type HandlerRegistry<
  TState,
  TAction extends { type: string },
  TContext extends RuntimeContext,
> = Map<string, HandlerEntry<TState, TAction, TContext>>;

export function buildRegistriesFromEntries<
  TState,
  TAction extends { type: string },
  TContext extends RuntimeContext,
>(
  entries: [string, HandlerEntry<TState, TAction, TContext>][],
): {
  handlerRegistry: HandlerRegistry<TState, TAction, TContext>;
  inverseRegistry: InverseRegistry<TAction>;
} {
  const handlerRegistry = new Map<
    string,
    HandlerEntry<TState, TAction, TContext>
  >(entries);
  const inverseRegistry = createInverseRegistry(
    Object.fromEntries(
      entries.map(([key, entry]) => [key, entry.inverse]),
    ) as Record<string, InverseComputer<unknown, TAction, RuntimeContext>>,
  );
  return { handlerRegistry, inverseRegistry };
}
