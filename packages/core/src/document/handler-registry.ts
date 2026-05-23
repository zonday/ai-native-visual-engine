import type { DocumentAction } from "./actions.js";
import type { DocumentHandler } from "./handler.js";

export type DocumentHandlerRegistry = Map<
  string,
  DocumentHandler<DocumentAction>
>;

export function createHandlerRegistry(
  handlers: Record<string, DocumentHandler<DocumentAction>>,
): DocumentHandlerRegistry {
  return new Map(Object.entries(handlers));
}
