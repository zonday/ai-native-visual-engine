import type { ActionRegistry } from "./action-registry.js";
import { HandlerError } from "./error.js";
import type { RuntimeContext } from "./handler.js";

export interface DispatchResult<TState> {
  ok: boolean;
  state: TState;
  error?: {
    code: string;
    message: string;
    actionType?: string;
    context?: Record<string, unknown>;
  };
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

const isDev = process.env.NODE_ENV !== "production";

export function createCommandBus<
  TState,
  TAction extends { type: string },
  TContext extends RuntimeContext,
>(
  registry: ActionRegistry<TAction, TState, TContext>,
  middlewares: Middleware<TState, TAction>[],
  initialState: TState,
  context: TContext,
): CommandBus<TState, TAction> {
  let currentState = initialState;
  return {
    dispatch(action: TAction): DispatchResult<TState> {
      const handler = registry.getHandler(action.type as TAction["type"]);
      if (!handler) {
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

      const handlerFn = handler;
      let runningState = currentState;
      const chain = [...middlewares];

      function runChain(): DispatchResult<TState> {
        if (chain.length === 0) {
          try {
            if (isDev) {
              const stateBefore = runningState;
              deepFreeze(runningState);
              runningState = handlerFn(runningState, action, context);
              detectSameRef(stateBefore, runningState, action);
              deepFreeze(runningState);
            } else {
              runningState = handlerFn(runningState, action, context);
            }
            return { ok: true, state: runningState };
          } catch (err) {
            if (err instanceof HandlerError) {
              return {
                ok: false,
                state: currentState,
                error: {
                  code: err.code,
                  message: err.message,
                  actionType: err.actionType ?? action.type,
                  context: err.context,
                },
              };
            }
            return {
              ok: false,
              state: currentState,
              error: {
                code: "handler-error",
                message: err instanceof Error ? err.message : String(err),
                actionType: action.type,
              },
            };
          }
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

/**
 * Wrap a generic CommandBus into a domain-specific dispatch interface.
 * Eliminates structural boilerplate in document/runtime command bus wrappers
 * by providing a generic pass-through for getState() and a result mapper.
 */
export function wrapCommandBus<
  TState,
  TAction extends { type: string },
  TResult,
>(
  bus: CommandBus<TState, TAction>,
  mapResult: (inner: DispatchResult<TState>, action: TAction) => TResult,
): { dispatch(action: TAction): TResult; getState(): TState } {
  return {
    dispatch(action: TAction): TResult {
      return mapResult(bus.dispatch(action), action);
    },
    getState(): TState {
      return bus.getState();
    },
  };
}

/**
 * Extract a domain-specific error field from a generic DispatchResult error.
 * The generic createCommandBus stores HandlerError.context in error.context,
 * so domain wrappers can extract pageId, nodeId etc. without their own try/catch.
 */
export function extractErrorField(
  error: DispatchResult<unknown>["error"],
  field: "pageId" | "nodeId",
): string | undefined {
  if (!error?.context) return undefined;
  const value = error.context[field];
  return typeof value === "string" ? value : undefined;
}
