// Runtime re-exports from register-handlers.ts (the single source of truth).
// Individual action types are re-exported from handler files for co-location.

export type { CreateNodeAction } from "./handlers/create-node.js";
export type { MoveNodeAction } from "./handlers/move-node.js";
export type { RemoveNodeAction } from "./handlers/remove-node.js";
export type { RotateNodeAction } from "./handlers/rotate-node.js";
export type { UpdateBindingsAction } from "./handlers/update-bindings.js";
export type { UpdateLayoutAction } from "./handlers/update-layout.js";
export type { UpdatePropsAction } from "./handlers/update-props.js";
export type { UpdateRuntimeAction } from "./handlers/update-runtime.js";
export type { UpdateSelectionAction } from "./handlers/update-selection.js";
export type { UpdateStyleAction } from "./handlers/update-style.js";
export type {
  BatchActions,
  RuntimeAction,
} from "./register-handlers.js";
export {
  BatchActionsSchema,
  createRuntimeRegistry,
  RuntimeActionSchema,
} from "./register-handlers.js";
