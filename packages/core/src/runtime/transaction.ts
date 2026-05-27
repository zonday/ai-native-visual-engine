import type { DispatchResult } from "../engine/transaction-manager.js";
import { TransactionManager } from "../engine/transaction-manager.js";
import type { SceneGraph } from "../types.js";
import type { RuntimeAction } from "./actions.js";
import type { DispatchResult as RuntimeDispatchResult } from "./command-bus.js";
import type { RuntimeContext } from "./handler.js";
import type {
  InverseRegistry,
  RuntimeHandlerRegistry,
} from "./handler-registry.js";
import { computeInverseAction } from "./handler-registry.js";

export type RuntimeTransactionManager = TransactionManager<
  SceneGraph,
  RuntimeAction,
  RuntimeContext
>;

export type RuntimeDispatchFn = (
  action: RuntimeAction,
) => DispatchResult<SceneGraph>;

export function createRuntimeTransactionManager(
  handlerRegistry: RuntimeHandlerRegistry,
  inverseRegistry: InverseRegistry,
  dispatchFn?: RuntimeDispatchFn,
): RuntimeTransactionManager {
  return new TransactionManager({
    handlerRegistry,
    dispatch: dispatchFn,
    computeInverseAction: (
      stateBefore: SceneGraph,
      action: RuntimeAction,
      context: RuntimeContext,
    ) => computeInverseAction(inverseRegistry, stateBefore, action, context),
  });
}

export function adaptRuntimeDispatch(
  dispatch: (action: RuntimeAction) => RuntimeDispatchResult,
): RuntimeDispatchFn {
  return (action) => {
    const result = dispatch(action);
    return { ok: result.ok, state: result.scene, error: result.error };
  };
}

export type { ActiveTransaction } from "../engine/transaction-manager.js";
export type {
  RuntimeTransaction,
  TransactionContext,
  TransactionResult,
  TransactionSource,
} from "../engine/transaction-types.js";
