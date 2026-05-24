import type { Middleware } from "../engine/command-bus.js";
import type { VisualDocument } from "../types.js";
import type { DocumentAction } from "./actions.js";

export type DocumentMiddleware = Middleware<VisualDocument, DocumentAction>;
