import { TransactionManager } from "../engine/transaction-manager.js";
import type { SceneGraph } from "../types.js";
import type { RuntimeAction } from "./actions.js";
import type {
  InverseRegistry,
  RuntimeContext,
  RuntimeHandlerRegistry,
} from "./handler-registry.js";
import { computeInverseAction } from "./handler-registry.js";

export type RuntimeTransactionManager = TransactionManager<
  SceneGraph,
  RuntimeAction,
  RuntimeContext
>;

export function createRuntimeTransactionManager(
  handlerRegistry: RuntimeHandlerRegistry,
  inverseRegistry: InverseRegistry,
): RuntimeTransactionManager {
  return new TransactionManager({
    handlerRegistry,
    computeInverseAction: (
      stateBefore: SceneGraph,
      action: RuntimeAction,
      context: RuntimeContext,
    ) => computeInverseAction(inverseRegistry, stateBefore, action, context),
  });
}

export type { ActiveTransaction } from "../engine/transaction-manager.js";
export type {
  RuntimeTransaction,
  TransactionContext,
  TransactionResult,
  TransactionSource,
} from "../engine/transaction-types.js";
