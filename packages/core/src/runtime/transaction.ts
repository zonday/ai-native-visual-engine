import type { ActionRegistry } from "../engine/action-registry.js";
import { TransactionManager } from "../engine/transaction-manager.js";
import type { SceneGraph } from "../types.js";
import type { RuntimeContext } from "./handler-registry.js";
import type { RuntimeAction } from "./register-handlers.js";

export type RuntimeTransactionManager = TransactionManager<
  SceneGraph,
  RuntimeAction,
  RuntimeContext
>;

export function createRuntimeTransactionManager(
  registry: ActionRegistry<RuntimeAction, SceneGraph, RuntimeContext>,
): RuntimeTransactionManager {
  return new TransactionManager({ registry });
}

export type { ActiveTransaction } from "../engine/transaction-manager.js";
export type {
  RuntimeTransaction,
  TransactionContext,
  TransactionResult,
  TransactionSource,
} from "../engine/transaction-types.js";
