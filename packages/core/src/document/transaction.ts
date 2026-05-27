import type { DispatchResult } from "../engine/transaction-manager.js";
import { TransactionManager } from "../engine/transaction-manager.js";
import type { VisualDocument } from "../types.js";
import type { DocumentAction } from "./actions.js";
import type { DocumentRuntimeContext } from "./handler.js";
import type {
  DocumentHandlerRegistry,
  InverseRegistry,
} from "./handler-registry.js";
import { computeInverseAction } from "./handler-registry.js";

export type DocumentTransactionManager = TransactionManager<
  VisualDocument,
  DocumentAction,
  DocumentRuntimeContext
>;

export type DocumentDispatchFn = (
  action: DocumentAction,
) => DispatchResult<VisualDocument>;

export function createDocumentTransactionManager(
  handlerRegistry: DocumentHandlerRegistry,
  inverseRegistry: InverseRegistry,
  dispatchFn?: DocumentDispatchFn,
): DocumentTransactionManager {
  return new TransactionManager({
    handlerRegistry,
    dispatch: dispatchFn,
    computeInverseAction: (
      stateBefore: VisualDocument,
      action: DocumentAction,
      context: DocumentRuntimeContext,
    ) => computeInverseAction(inverseRegistry, stateBefore, action, context),
  });
}
