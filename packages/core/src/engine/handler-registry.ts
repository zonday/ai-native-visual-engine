import type { Handler, RuntimeContext } from "./handler.js";

export type InverseComputer<
  TState,
  TAction,
  TContext extends RuntimeContext,
> = (
  stateBefore: TState,
  action: TAction,
  context: TContext,
) => TAction | undefined;

export type InverseRegistry<TAction> = Map<
  string,
  InverseComputer<unknown, TAction, RuntimeContext>
>;

export function createInverseRegistry<TAction>(
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
  // Registry stores InverseComputer<unknown, TAction, ...> for heterogeneous
  // storage; the cast assumes the caller provided the correct state type.
  return computer(stateBefore, action, context) as TAction | undefined;
}

export interface HandlerEntry<
  TState,
  TAction,
  TContext extends RuntimeContext,
> {
  handler: Handler<TState, TAction, TContext>;
  inverse: InverseComputer<TState, TAction, TContext>;
}

export type HandlerRegistry<
  TState,
  TAction,
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
  // Type assertion: the inverse computers at runtime match the wider signature
  // needed by InverseRegistry — the cast is safe because we only .get() and
  // invoke the stored functions, which are already the real (narrower) types.
  const inverseRegistry = createInverseRegistry(
    Object.fromEntries(
      entries.map(([key, entry]) => [key, entry.inverse]),
    ) as Record<string, InverseComputer<unknown, TAction, RuntimeContext>>,
  );
  return { handlerRegistry, inverseRegistry };
}
