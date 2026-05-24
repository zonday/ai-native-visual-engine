import type {
  HandlerEntry,
  HandlerRegistry,
  InverseComputer,
} from "../engine/handler-registry.js";
import type { SceneGraph } from "../types.js";
import type { RuntimeAction } from "./actions.js";
import type { RuntimeContext } from "./handler.js";

export type RuntimeHandlerEntry = HandlerEntry<
  SceneGraph,
  RuntimeAction,
  RuntimeContext
>;

export type RuntimeHandlerRegistry = HandlerRegistry<
  SceneGraph,
  RuntimeAction,
  RuntimeContext
>;

export type { InverseComputer };
