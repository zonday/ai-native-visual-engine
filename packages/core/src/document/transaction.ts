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

export function createDocumentTransactionManager(
  handlerRegistry: DocumentHandlerRegistry,
  inverseRegistry: InverseRegistry,
): DocumentTransactionManager {
  return new TransactionManager({
    handlerRegistry,
    computeInverseAction: (
      stateBefore: VisualDocument,
      action: DocumentAction,
      context: DocumentRuntimeContext,
    ) => computeInverseAction(inverseRegistry, stateBefore, action, context),
  });
}
