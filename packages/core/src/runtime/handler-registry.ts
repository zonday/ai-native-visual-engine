import type { RuntimeAction } from "./actions.js";
import type { RuntimeHandler } from "./handler.js";
import type { InverseComputer } from "./inverse-registry.js";

export interface RuntimeHandlerEntry {
  handler: RuntimeHandler<RuntimeAction>;
  inverse: InverseComputer;
}

export type RuntimeHandlerRegistry = Map<string, RuntimeHandlerEntry>;
