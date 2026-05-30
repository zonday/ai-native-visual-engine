import type { ActionRegistry, HandlerMap } from "../engine/action-registry.js";
import type { Handler, RuntimeContext } from "../engine/handler.js";
import type {
  HandlerRegistry as EngineHandlerRegistry,
  HandlerEntry,
} from "../engine/handler-registry.js";
import type { VisualDocument } from "../types.js";
import type { DocumentAction } from "./register-handlers.js";

export interface DocumentRuntimeContext extends RuntimeContext {}

export type { ActionRegistry, HandlerMap, RuntimeContext };

export type DocumentHandler<TAction extends DocumentAction = DocumentAction> =
  Handler<VisualDocument, TAction, DocumentRuntimeContext>;

export type DocumentHandlerEntry = HandlerEntry<
  VisualDocument,
  DocumentAction,
  DocumentRuntimeContext
>;

export type DocumentHandlerRegistry = EngineHandlerRegistry<
  VisualDocument,
  DocumentAction,
  DocumentRuntimeContext
>;

// Return type is the wider DocumentAction (not TAction) because inverse
// computers often produce a different action type than they consume
// (e.g., create-page inverse returns remove-page).
export type InverseComputer<TAction extends DocumentAction = DocumentAction> = (
  documentBefore: VisualDocument,
  action: TAction,
  context: DocumentRuntimeContext,
) => DocumentAction | undefined;

export type InverseRegistry = Map<string, InverseComputer>;

export function createInverseRegistry(
  computers: Record<string, InverseComputer>,
): InverseRegistry {
  return new Map(Object.entries(computers));
}

export function computeInverseAction(
  registry: InverseRegistry,
  documentBefore: VisualDocument,
  action: DocumentAction,
  context: DocumentRuntimeContext,
): DocumentAction | undefined {
  const computer = registry.get(action.type);
  if (!computer) return undefined;
  return computer(documentBefore, action, context);
}

export type DocumentEntryFor<K extends DocumentAction["type"]> = HandlerMap<
  DocumentAction,
  VisualDocument,
  DocumentRuntimeContext
>[K];

export const STANDARD_ACTION_META = {
  undoable: true,
  mergeable: false,
} as const;
