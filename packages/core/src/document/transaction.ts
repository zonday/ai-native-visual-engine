import type { DispatchResult } from "../engine/transaction-manager.js";
import { TransactionManager } from "../engine/transaction-manager.js";
import type { VisualDocument } from "../types.js";
import type { DocumentAction } from "./actions.js";
import type { DocumentDispatchResult } from "./command-bus.js";
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

export function adaptDocumentDispatch(
  dispatch: (action: DocumentAction) => DocumentDispatchResult,
): DocumentDispatchFn {
  return (action) => {
    const result = dispatch(action);
    return { ok: result.ok, state: result.document, error: result.error };
  };
}
