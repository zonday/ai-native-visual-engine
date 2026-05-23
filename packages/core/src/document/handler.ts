import type { VisualDocument } from "../types.js";

export interface DocumentRuntimeContext {
  now: () => number;
  actorId?: string;
}

export type DocumentHandler<TAction> = (
  document: VisualDocument,
  action: TAction,
  context: DocumentRuntimeContext,
) => VisualDocument;
