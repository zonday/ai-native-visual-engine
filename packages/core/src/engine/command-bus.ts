import type { RuntimeContext } from "./handler.js";
import type { HandlerRegistry } from "./handler-registry.js";

export interface DispatchResult<TState> {
  ok: boolean;
  state: TState;
  error?: { code: string; message: string; actionType?: string };
}

export interface CommandBus<TState, TAction> {
  dispatch(action: TAction): DispatchResult<TState>;
  getState(): TState;
}

export type Middleware<TState, TAction> = (
  action: TAction,
  state: TState,
  next: () => DispatchResult<TState>,
) => DispatchResult<TState>;

function deepFreeze<T>(value: T, seen?: WeakSet<object>): T {
  if (value === null || typeof value !== "object") return value;
  if (Object.isFrozen(value)) return value;
  seen ??= new WeakSet();
  if (seen.has(value)) return value;
  seen.add(value);
  for (const key of Reflect.ownKeys(value)) {
    deepFreeze((value as Record<symbol | string, unknown>)[key], seen);
  }
  return Object.freeze(value);
}

function detectSameRef<T>(before: T, after: T, action: { type: string }): void {
  if (after === before) {
    console.warn(
      `[immutability] handler for "${action.type}" returned same object reference. Handlers must return a new state, not mutate in place.`,
    );
  }
}

const isDev =
  typeof process !== "undefined" && process.env.NODE_ENV !== "production";

export function createCommandBus<
  TState,
  TAction extends { type: string },
  TContext extends RuntimeContext,
>(
  registry: HandlerRegistry<TState, TAction, TContext>,
  middlewares: Middleware<TState, TAction>[],
  initialState: TState,
  context: TContext,
): CommandBus<TState, TAction> {
  let currentState = initialState;
  return {
    dispatch(action: TAction): DispatchResult<TState> {
      const entry = registry.get(action.type);
      if (!entry) {
        return {
          ok: false,
          state: currentState,
          error: {
            code: "unknown-action-type",
            message: `Unknown action type: ${action.type}`,
            actionType: action.type,
          },
        };
      }

      const handler = entry.handler;
      let runningState = currentState;
      const chain = [...middlewares];

      function runChain(): DispatchResult<TState> {
        if (chain.length === 0) {
          if (isDev) {
            const stateBefore = runningState;
            deepFreeze(runningState);
            runningState = handler(runningState, action, context);
            detectSameRef(stateBefore, runningState, action);
          } else {
            runningState = handler(runningState, action, context);
          }
          return { ok: true, state: runningState };
        }
        const mw = chain.shift();
        if (!mw)
          return {
            ok: false,
            state: runningState,
            error: {
              code: "middleware-error",
              message: "Middleware chain broken",
            },
          };
        return mw(action, runningState, runChain);
      }

      const result = runChain();
      if (result.ok) {
        currentState = result.state;
      }
      return result;
    },
    getState(): TState {
      return currentState;
    },
  };
}

export { deepFreeze, detectSameRef, isDev };
