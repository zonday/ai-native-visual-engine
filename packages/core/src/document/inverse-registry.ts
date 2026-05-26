import type { VisualDocument } from "../types.js";
import type { DocumentAction } from "./actions.js";
import type { DocumentRuntimeContext } from "./handler.js";

export type InverseComputer<
  TAction extends DocumentAction = DocumentAction,
> = (
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