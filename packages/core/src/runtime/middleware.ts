import type { Middleware } from "../engine/command-bus.js";
import type { SceneGraph } from "../types.js";
import type { RuntimeAction } from "./actions.js";

export type RuntimeMiddleware = Middleware<SceneGraph, RuntimeAction>;
